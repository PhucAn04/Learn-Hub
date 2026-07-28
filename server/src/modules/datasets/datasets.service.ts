import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { Model } from '../models/entities/model.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UsersService } from '../users/users.service';
import { GoogleDriveService } from '../integrations/google-drive.service';
import { TrainingSample } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class DatasetsService {
  private readonly uploadDir: string;
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(Model)
    private readonly modelRepository: Repository<Model>,
    private readonly usersService: UsersService,
    private readonly googleDriveService: GoogleDriveService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'datasets');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async createDataset(userId: string, dto: CreateDatasetDto): Promise<{ dataset: Dataset; model: Model }> {
    // Cast DTO samples to TrainingSample[] (DTO uses Record<string, unknown>[] for decorator metadata compatibility)
    const samples = dto.samples as unknown as TrainingSample[];

    // Save samples to JSON file
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}.json`;
    const filePath = path.join(this.uploadDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(samples, null, 2), 'utf-8');

    // Build class summary from samples
    const classSummary: Record<string, number> = {};
    if (Array.isArray(samples)) {
      for (const sample of samples) {
        const label = sample.label || 'unknown';
        classSummary[label] = (classSummary[label] || 0) + 1;
      }
    }

    // Create dataset record
    const dataset = this.datasetRepository.create({
      userId,
      challengeType: dto.challengeType || 'teach',
      dataFileUrl: filePath,
      sampleCount: Array.isArray(samples) ? samples.length : 0,
      classSummary,
      isTemplate: dto.isTemplate || false,
      teacherNotes: dto.teacherNotes || '',
      isPublished: dto.isPublished || false,
      dataSourceType: dto.dataSourceType || 'camera',
      customClasses: dto.customClasses,
    });
    const savedDataset = await this.datasetRepository.save(dataset);

    // Create model record
    const model = this.modelRepository.create({
      userId,
      datasetId: savedDataset.id,
      testScore: dto.testScore || 0,
    });
    const savedModel = await this.modelRepository.save(model);

    // [Background Task] Upload media to Google Drive if user is connected
    this.uploadToGoogleDrive(userId, savedDataset.id, dto.challengeType, samples).catch(err => {
      this.logger.error(`Background upload to Google Drive failed: ${err.message}`);
    });

    return { dataset: savedDataset, model: savedModel };
  }

  private async uploadToGoogleDrive(userId: string, datasetId: string, challengeType: string, samples: TrainingSample[]) {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || !user.googleAccessToken) {
        return; // User hasn't connected Google Drive
      }

      this.logger.log(`Starting background upload to Google Drive for dataset ${datasetId}`);
      
      const folderName = `Learn-Hub-${challengeType}-${new Date().toISOString().split('T')[0]}`;
      const folderId = await this.googleDriveService.ensureAppFolder(user.googleAccessToken, folderName);

      let driveUrl = '';
      
      // We will only upload the first few samples to avoid rate limiting for now, 
      // or we upload them sequentially
      let count = 0;
      for (const sample of samples) {
        if (!sample.thumbnail && !sample.rawThumbnail) continue;
        
        const dataUrl = sample.thumbnail || sample.rawThumbnail;
        if (!dataUrl) continue;
        const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = matches[1] === 'image/jpeg' ? 'jpg' : 'png';
          const fileName = `${sample.label}_${Date.now()}_${count}.${ext}`;
          
          const url = await this.googleDriveService.uploadImage(user.googleAccessToken, buffer, fileName, folderId);
          if (!driveUrl) driveUrl = url; // Save the first URL to the dataset
          count++;
          
          // Optional: max 50 images per dataset to save time/space
          if (count >= 50) break;
        }
      }

      if (driveUrl) {
        await this.datasetRepository.update(datasetId, { googleDriveFolderUrl: driveUrl });
        this.logger.log(`Finished Google Drive upload for dataset ${datasetId}. URL: ${driveUrl}`);
      }
    } catch (error) {
      this.logger.error(`Error in background Google Drive upload: ${error.message}`);
    }
  }

  async getDatasetsByUser(userId: string, challengeType?: string): Promise<(Omit<Dataset, 'models'> & { model: Model | null })[]> {
    const where: FindOptionsWhere<Dataset> = { userId };
    if (challengeType) {
      where.challengeType = challengeType;
    }

    const datasets = await this.datasetRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: { user: true, models: true },
    });

    // Transform to include a single 'model' field for frontend convenience
    return datasets.map(ds => ({
      ...ds,
      model: ds.models && ds.models.length > 0 ? ds.models[0] : null,
      models: undefined,
    }));
  }

  async getDatasetById(datasetId: string): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId },
      relations: { user: true },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset không tồn tại.');
    }
    return dataset;
  }

  async getDatasetFile(datasetId: string): Promise<TrainingSample[]> {
    const dataset = await this.datasetRepository.findOne({ where: { id: datasetId } });
    if (!dataset) {
      throw new NotFoundException('Dataset không tồn tại.');
    }

    if (!dataset.dataFileUrl || !fs.existsSync(dataset.dataFileUrl)) {
      throw new NotFoundException('File dữ liệu không tồn tại.');
    }

    const content = fs.readFileSync(dataset.dataFileUrl, 'utf-8');
    return JSON.parse(content);
  }

  async getAllDatasetsByChallengeType(challengeType: string): Promise<(Omit<Dataset, 'models'> & { model: Model | null })[]> {
    const datasets = await this.datasetRepository.find({
      where: { challengeType, isTemplate: false },
      relations: { user: true, models: true },
      order: { createdAt: 'DESC' },
    });

    // Transform to include a single 'model' field for frontend convenience
    return datasets.map(ds => ({
      ...ds,
      model: ds.models && ds.models.length > 0 ? ds.models[0] : null,
      models: undefined,
    }));
  }

  async getTemplates(challengeType?: string): Promise<Dataset[]> {
    const where: FindOptionsWhere<Dataset> = { isTemplate: true, isPublished: true };
    if (challengeType) {
      where.challengeType = challengeType;
    }
    return this.datasetRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
  }

  async togglePublish(datasetId: string, userId: string, isPublished: boolean): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId, userId },
    });
    if (!dataset) {
      throw new NotFoundException('Dataset không tồn tại hoặc bạn không có quyền chỉnh sửa.');
    }
    dataset.isPublished = isPublished;
    return this.datasetRepository.save(dataset);
  }
}
