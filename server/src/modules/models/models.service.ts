import 'multer';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';
import { CloudinaryService } from '../integrations/cloudinary.service';
import { GoogleDriveService } from '../integrations/google-drive.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    @InjectRepository(Model)
    private readonly modelRepository: Repository<Model>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly usersService: UsersService,
  ) {}

  async getModelsByDatasetId(datasetId: string): Promise<Model[]> {
    return this.modelRepository.find({
      where: { datasetId },
      relations: { dataset: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getModelsByUser(
    userId: string,
    challengeType?: string,
  ): Promise<Model[]> {
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.dataset', 'dataset')
      .leftJoinAndSelect('model.user', 'user')
      .where('model.userId = :userId', { userId });

    if (challengeType) {
      queryBuilder.andWhere('dataset.challengeType = :challengeType', {
        challengeType,
      });
    }

    queryBuilder.orderBy('model.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async getModelChain(userId: string, challengeType: string): Promise<Model[]> {
    return this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.dataset', 'dataset')
      .where('model.userId = :userId', { userId })
      .andWhere('dataset.challengeType = :challengeType', { challengeType })
      .orderBy('model.version', 'ASC')
      .getMany();
  }

  async getModelById(modelId: string): Promise<Model> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId },
      relations: { dataset: true, user: true, parentModel: true },
    });
    if (!model) {
      throw new NotFoundException('Model không tồn tại.');
    }
    return model;
  }

  async updateModelArtifacts(
    modelId: string,
    userId: string,
    data: {
      algorithm?: string;
      modelArtifactUrl?: string;
      testScore?: number;
      hyperparameters?: {
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        k?: number;
      };
      trainingLogs?: { epoch: number; loss: number; acc: number }[];
      version?: number;
      parentModelId?: string;
      evaluation?: Model['evaluation'];
    },
  ): Promise<Model> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId, userId },
    });
    if (!model) {
      throw new NotFoundException(
        'Model không tồn tại hoặc bạn không có quyền truy cập.',
      );
    }

    if (data.algorithm) model.algorithm = data.algorithm;
    if (data.modelArtifactUrl !== undefined)
      model.modelArtifactUrl = data.modelArtifactUrl;
    if (data.testScore !== undefined) model.testScore = data.testScore;
    if (data.hyperparameters) model.hyperparameters = data.hyperparameters;
    if (data.trainingLogs) model.trainingLogs = data.trainingLogs;
    if (data.version !== undefined) model.version = data.version;
    if (data.parentModelId !== undefined)
      model.parentModelId = data.parentModelId;
    if (data.evaluation) model.evaluation = data.evaluation;

    return this.modelRepository.save(model);
  }

  async uploadModelFiles(
    modelId: string,
    userId: string,
    files: Express.Multer.File[],
  ): Promise<Model> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId, userId },
    });
    if (!model) {
      throw new NotFoundException(
        'Model không tồn tại hoặc bạn không có quyền truy cập.',
      );
    }

    let folderUrl = '';

    for (const file of files) {
      try {
        const uploadResult = await this.cloudinaryService.uploadFileStream(
          file.buffer,
          `learn-hub/models/${modelId}`,
          file.originalname,
          'raw',
        );
        // Save the base folder URL (by removing the filename from secure_url)
        if (!folderUrl) {
          const urlParts = uploadResult.secure_url.split('/');
          urlParts.pop(); // remove filename
          folderUrl = urlParts.join('/') + '/';
        }
      } catch (err) {
        this.logger.error(`Upload failed for ${file.originalname}`, err);
      }
    }

    if (folderUrl) {
      model.modelArtifactUrl = folderUrl;
      await this.modelRepository.save(model);
    }

    // [Background Task] Upload model to Google Drive if user is connected
    this.usersService
      .findById(userId)
      .then(async (user) => {
        if (user && user.googleAccessToken) {
          this.logger.log(
            `Starting background upload to Google Drive for model ${modelId}`,
          );
          const folderName = `Learn-Hub-Model-${new Date().toISOString().split('T')[0]}`;
          try {
            const folderId = await this.googleDriveService.ensureAppFolder(
              user.googleAccessToken,
              folderName,
            );
            for (const file of files) {
              await this.googleDriveService.uploadFile(
                user.googleAccessToken,
                file.buffer,
                file.originalname,
                'application/octet-stream',
                folderId,
              );
            }
            this.logger.log(
              `Finished Google Drive upload for model ${modelId}`,
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Background upload to Google Drive failed: ${errMsg}`,
            );
          }
        }
      })
      .catch((err) => {
        this.logger.error(
          `Failed to fetch user for Google Drive upload: ${err}`,
        );
      });

    return model;
  }

  async addTeacherFeedback(modelId: string, feedback: string): Promise<Model> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId },
    });
    if (!model) {
      throw new NotFoundException('Model không tồn tại.');
    }

    model.teacherFeedback = feedback;
    return this.modelRepository.save(model);
  }
}
