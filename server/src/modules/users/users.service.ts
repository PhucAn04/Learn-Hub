import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: email.toLowerCase().trim() });

    if (includePassword) {
      query.addSelect('user.password');
    }

    return query.getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  async updateGoogleTokens(
    userId: string,
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    const update: Partial<User> = { googleAccessToken: accessToken };
    if (refreshToken) {
      update.googleRefreshToken = refreshToken;
    }
    await this.userRepository.update(userId, update);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }
}
