import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../users/entities/user.entity';
import { AdminLoginDto } from '../dto/admin.dto';
import { AdminGuard } from '../guards/admin.guard';
import type { Request } from 'express';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  async login(@Body() body: AdminLoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: body.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        username: true,
        avatar: true,
      },
    });

    if (!user || user.role !== 'admin' || !user.password) {
      throw new UnauthorizedException(
        'Email hoặc mật khẩu không chính xác, hoặc bạn không có quyền admin',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản quản trị này đã bị vô hiệu hóa',
      );
    }

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Remove password from response
    delete user.password;

    const token = this.jwtService.sign({ sub: user.id });

    return { user, accessToken: token };
  }

  @Get('profile')
  @UseGuards(AdminGuard)
  getProfile(@Req() req: Request & { user: User }) {
    return req.user;
  }
}
