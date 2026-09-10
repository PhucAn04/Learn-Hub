import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AdminUserQueryDto } from '../dto/admin.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAllPaginated(query: AdminUserQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere('(user.email ILIKE :search OR user.username ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('user.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneById(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  async changeRole(id: string, role: string, adminId: string) {
    const user = await this.findOneById(id);
    user.role = role;
    user.roleChangedBy = adminId;
    user.roleChangedAt = new Date();
    return this.userRepository.save(user);
  }

  async toggleActive(id: string, isActive: boolean, adminId: string) {
    const user = await this.findOneById(id);
    user.isActive = isActive;
    if (!isActive) {
      user.deactivatedBy = adminId;
      user.deactivatedAt = new Date();
    }
    return this.userRepository.save(user);
  }

  async getStats() {
    const total = await this.userRepository.count();
    const activeCount = await this.userRepository.count({
      where: { isActive: true },
    });
    const studentCount = await this.userRepository.count({
      where: { role: 'student' },
    });
    const teacherCount = await this.userRepository.count({
      where: { role: 'teacher' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qb = this.userRepository.createQueryBuilder('user');
    qb.where('user.createdAt >= :today', { today });
    const newToday = await qb.getCount();

    return {
      total,
      activeCount,
      byRole: {
        student: studentCount,
        teacher: teacherCount,
      },
      newToday,
    };
  }
}
