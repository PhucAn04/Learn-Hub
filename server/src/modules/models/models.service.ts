import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(Model)
    private readonly modelRepository: Repository<Model>,
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

  async getModelById(modelId: string): Promise<Model> {
    const model = await this.modelRepository.findOne({
      where: { id: modelId },
      relations: { dataset: true, user: true },
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

    return this.modelRepository.save(model);
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
