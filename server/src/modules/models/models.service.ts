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

  async getModelsByUser(userId: string, challengeType?: string): Promise<Model[]> {
    const queryBuilder = this.modelRepository
      .createQueryBuilder('model')
      .leftJoinAndSelect('model.dataset', 'dataset')
      .leftJoinAndSelect('model.user', 'user')
      .where('model.userId = :userId', { userId });

    if (challengeType) {
      queryBuilder.andWhere('dataset.challengeType = :challengeType', { challengeType });
    }

    queryBuilder.orderBy('model.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async addTeacherFeedback(modelId: string, feedback: string): Promise<Model> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException('Model không tồn tại.');
    }

    model.teacherFeedback = feedback;
    return this.modelRepository.save(model);
  }
}
