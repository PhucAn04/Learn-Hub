import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from './entities/assessment.entity';

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepository: Repository<Assessment>,
  ) {}

  async create(data: Partial<Assessment>): Promise<Assessment> {
    const assessment = this.assessmentRepository.create(data);
    return this.assessmentRepository.save(assessment);
  }

  async upsert(
    userId: string,
    challengeType: string,
    data: Partial<Assessment>,
  ): Promise<Assessment> {
    const existing = await this.assessmentRepository.findOne({
      where: { userId, challengeType },
    });
    if (existing) {
      Object.assign(existing, data);
      return this.assessmentRepository.save(existing);
    }
    return this.create({ ...data, userId, challengeType });
  }

  async getByUser(userId: string): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getByUserAndChallenge(
    userId: string,
    challengeType: string,
  ): Promise<Assessment | null> {
    return this.assessmentRepository.findOne({
      where: { userId, challengeType },
    });
  }

  async getAllForTeacher(): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }
}
