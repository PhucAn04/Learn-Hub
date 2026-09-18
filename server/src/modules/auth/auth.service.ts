import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../../shared/mail/mail.service';
import { User } from '../users/entities/user.entity';
import { GoogleOAuthProfile } from '../../shared/types';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return true to avoid email enumeration attacks
      return true;
    }

    const resetToken = await this.generatePasswordResetToken(user.id);
    const domain = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${domain}/auth/reset-password?token=${resetToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, resetLink);
    return true;
  }

  async register(
    userData: Partial<User>,
  ): Promise<{ user: User; accessToken: string }> {
    if (!userData.email || !userData.password) {
      throw new BadRequestException('Email và mật khẩu là bắt buộc.');
    }

    const existing = await this.usersService.findByEmail(userData.email);
    if (existing) {
      throw new ConflictException(
        'Email đã được đăng ký bởi một tài khoản khác.',
      );
    }

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    if (userData.email) {
      userData.email = userData.email.toLowerCase().trim();
    }

    const user = await this.usersService.create(userData);
    const accessToken = this.generateToken(user.id);

    return { user, accessToken };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; accessToken: string }> {
    const user = await this.usersService.findByEmail(email, true);
    if (!user || !user.password) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // Remove password before returning
    delete user.password;

    // Update last login
    await this.usersService.updateLastLogin(user.id);
    user.lastLoginAt = new Date();

    const accessToken = this.generateToken(user.id);

    return { user, accessToken };
  }

  async validateOAuthLogin(
    profile: GoogleOAuthProfile,
  ): Promise<{ user: User; accessToken: string }> {
    const {
      email,
      firstName,
      lastName,
      picture,
      googleId,
      accessToken,
      refreshToken,
    } = profile;
    const username =
      `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0];

    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      // Check if user exists by email
      user = await this.usersService.findByEmail(email);
      if (user) {
        // Link google account to existing user
        user.googleId = googleId;
        user.avatarUrl = picture;
      } else {
        // Create new user
        user = await this.usersService.create({
          email,
          username,
          googleId,
          avatarUrl: picture,
          role: 'student', // default role
        });
      }
    } else {
      // Update existing user's avatar if changed
      if (picture && user.avatarUrl !== picture) {
        user.avatarUrl = picture;
      }
    }

    // Always update tokens and last login
    await this.usersService.updateGoogleTokens(
      user.id,
      accessToken,
      refreshToken,
    );
    await this.usersService.updateLastLogin(user.id);

    // Refresh user object to return
    const updatedUser = (await this.usersService.findById(user.id)) || user;

    const jwtToken = this.generateToken(updatedUser.id);
    return { user: updatedUser, accessToken: jwtToken };
  }

  private generateToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const resetToken = (await import('crypto')).randomBytes(32).toString('hex');
    const hashedToken = await this.hashResetToken(resetToken);

    // Set expiration to 15 minutes
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    await this.usersService.updateResetToken(userId, hashedToken, expires);

    return resetToken;
  }

  private async hashResetToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const hashedToken = await this.hashResetToken(token);
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Token đã hết hạn. Vui lòng tạo lại.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return true;
  }
}
