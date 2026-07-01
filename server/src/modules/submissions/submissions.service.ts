import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
  ) {}

  async createSubmission(userId: string, dto: CreateSubmissionDto): Promise<Submission> {
    const submission = this.submissionRepository.create({
      userId,
      challengeType: dto.challengeType || 'teach',
      accuracy: dto.accuracy,
      dataset: dto.dataset,
      reflectionAnswer: dto.reflectionAnswer,
    });
    return this.submissionRepository.save(submission);
  }

  async getAllSubmissions(): Promise<any[]> {
    return this.submissionRepository.find({
      relations: {
        user: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
