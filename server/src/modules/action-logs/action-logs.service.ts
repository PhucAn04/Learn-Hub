import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionLog } from './entities/action-log.entity';

@Injectable()
export class ActionLogsService {
  constructor(
    @InjectRepository(ActionLog)
    private readonly actionLogRepository: Repository<ActionLog>,
  ) {}

  async create(data: {
    userId: string;
    modelId: string;
    action: string;
    details?: ActionLog['details'];
  }): Promise<ActionLog> {
    const log = this.actionLogRepository.create(data);
    return this.actionLogRepository.save(log);
  }

  async createBatch(
    logs: {
      userId: string;
      modelId: string;
      action: string;
      details?: ActionLog['details'];
    }[],
  ): Promise<ActionLog[]> {
    const entities = this.actionLogRepository.create(logs);
    return this.actionLogRepository.save(entities);
  }

  async getByModelId(modelId: string): Promise<ActionLog[]> {
    return this.actionLogRepository.find({
      where: { modelId },
      order: { createdAt: 'ASC' },
    });
  }

  async getByUserId(userId: string): Promise<ActionLog[]> {
    return this.actionLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
