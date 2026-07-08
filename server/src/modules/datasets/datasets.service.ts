import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { Model } from '../models/entities/model.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class DatasetsService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(Model)
    private readonly modelRepository: Repository<Model>,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'datasets');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async createDataset(userId: string, dto: CreateDatasetDto): Promise<{ dataset: Dataset; model: Model }> {
    // Save samples to JSON file
    const fileId = crypto.randomUUID();
    const fileName = `${fileId}.json`;
    const filePath = path.join(this.uploadDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(dto.samples, null, 2), 'utf-8');

    // Build class summary from samples
    const classSummary: Record<string, number> = {};
    if (Array.isArray(dto.samples)) {
      for (const sample of dto.samples) {
        const label = sample.label || sample.class || 'unknown';
        classSummary[label] = (classSummary[label] || 0) + 1;
      }
    }

    // Create dataset record
    const dataset = this.datasetRepository.create({
      userId,
      challengeType: dto.challengeType || 'teach',
      dataFileUrl: filePath,
      sampleCount: Array.isArray(dto.samples) ? dto.samples.length : 0,
      classSummary,
    });
    const savedDataset = await this.datasetRepository.save(dataset);

    // Create model record
    const model = this.modelRepository.create({
      userId,
      datasetId: savedDataset.id,
      testScore: dto.testScore || 0,
    });
    const savedModel = await this.modelRepository.save(model);

    return { dataset: savedDataset, model: savedModel };
  }

  async getDatasetsByUser(userId: string, challengeType?: string): Promise<any[]> {
    const where: any = { userId };
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

  async getDatasetFile(datasetId: string): Promise<any> {
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

  async getAllDatasetsByChallengeType(challengeType: string): Promise<any[]> {
    const datasets = await this.datasetRepository.find({
      where: { challengeType },
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
}
