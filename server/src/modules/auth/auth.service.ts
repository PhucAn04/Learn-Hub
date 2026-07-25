import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(userData: Partial<User>): Promise<{ user: User; accessToken: string }> {
    if (!userData.email || !userData.password) {
      throw new BadRequestException('Email và mật khẩu là bắt buộc.');
    }

    const existing = await this.usersService.findByEmail(userData.email);
    if (existing) {
      throw new ConflictException('Email đã được đăng ký bởi một tài khoản khác.');
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

  async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
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
    
    const accessToken = this.generateToken(user.id);

    return { user, accessToken };
  }

  async validateOAuthLogin(profile: any): Promise<{ user: User; accessToken: string }> {
    const { email, firstName, lastName, picture, googleId, accessToken, refreshToken } = profile;
    const username = `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0];

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

    // Always update tokens
    await this.usersService.updateGoogleTokens(user.id, accessToken, refreshToken);
    
    // Refresh user object to return
    user = await this.usersService.findById(user.id) as User;

    const jwtToken = this.generateToken(user.id);
    return { user, accessToken: jwtToken };
  }

  private generateToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }
}
