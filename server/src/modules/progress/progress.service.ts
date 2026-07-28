import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Progress } from './entities/progress.entity';

import { LeaderboardEntry } from '../../shared/types';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
  ) {}

  async saveProgress(userId: string, challengeType: string, score: number): Promise<Progress> {
    const progress = this.progressRepository.create({
      userId,
      challengeType,
      score,
    });
    return this.progressRepository.save(progress);
  }

  async getLeaderboard(challengeType: string): Promise<LeaderboardEntry[]> {
    const rawData = await this.progressRepository
      .createQueryBuilder('progress')
      .innerJoin('progress.user', 'user')
      .select([
        'user.id AS userId',
        'user.username AS username',
        'user.avatar AS avatar',
        'MAX(progress.score) AS highScore',
        'MAX(progress.completedAt) AS lastCompletedAt',
      ])
      .where('progress.challengeType = :challengeType', { challengeType })
      .groupBy('user.id')
      .orderBy('highScore', 'DESC')
      .limit(10)
      .getRawMany();

    return rawData.map(item => ({
      userId: item.userid,
      username: item.username,
      avatar: item.avatar,
      score: parseInt(item.highscore, 10) || 0,
      highScore: parseInt(item.highscore, 10) || 0,
      completedAt: item.lastcompletedat,
    }));
  }

  async getUserStats(userId: string): Promise<Record<string, number>> {
    const rawData = await this.progressRepository
      .createQueryBuilder('progress')
      .select([
        'progress.challengeType AS challengeType',
        'MAX(progress.score) AS highScore',
      ])
      .where('progress.userId = :userId', { userId })
      .groupBy('progress.challengeType')
      .getRawMany();

    // Convert array to a key-value record
    const stats: Record<string, number> = {
      fingers: 0,
      gestures: 0,
      face: 0,
    };

    rawData.forEach(item => {
      stats[item.challengetype] = parseInt(item.highscore, 10);
    });

    return stats;
  }
}
