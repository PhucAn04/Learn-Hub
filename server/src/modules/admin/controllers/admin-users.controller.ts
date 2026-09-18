import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
  Post,
} from '@nestjs/common';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminGuard } from '../guards/admin.guard';
import {
  AdminUserQueryDto,
  ChangeRoleDto,
  ToggleStatusDto,
} from '../dto/admin.dto';
import type { Request } from 'express';
import { User } from '../../users/entities/user.entity';
import { AuthService } from '../../auth/auth.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.adminUsersService.getStats();
  }

  @Get('users')
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.findAllPaginated(query);
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminUsersService.findOneById(id);
  }

  @Patch('users/:id/role')
  async changeRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminUsersService.changeRole(id, body.role, req.user.id);
  }

  @Patch('users/:id/status')
  async toggleStatus(
    @Param('id') id: string,
    @Body() body: ToggleStatusDto,
    @Req() req: Request & { user: User },
  ) {
    return this.adminUsersService.toggleActive(id, body.isActive, req.user.id);
  }

  @Post('users/:id/generate-reset-link')
  async generateResetLink(@Param('id') id: string) {
    const resetToken = await this.authService.generatePasswordResetToken(id);
    const domain = process.env.FRONTEND_URL || 'http://localhost:3000';
    return { resetLink: `${domain}/auth/reset-password?token=${resetToken}` };
  }

  @Post('users/:id/send-reset-email')
  async sendResetEmail(@Param('id') id: string) {
    const user = await this.adminUsersService.findOneById(id);
    await this.authService.sendPasswordResetEmail(user.email);
    return { success: true };
  }
}
