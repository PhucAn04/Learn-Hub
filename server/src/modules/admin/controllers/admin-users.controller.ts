import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
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

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

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
}
