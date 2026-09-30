import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActionLogsService } from './action-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Action Logs')
@Controller('action-logs')
export class ActionLogsController {
  constructor(private readonly actionLogsService: ActionLogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ghi nhật ký hành vi học sinh (batch)' })
  @ApiResponse({ status: 201, description: 'Ghi log thành công.' })
  async createBatch(
    @CurrentUser() user: User,
    @Body()
    body: {
      modelId: string;
      logs: {
        action: string;
        details?: {
          samplesAdded?: number;
          samplesDeleted?: number;
          targetLabel?: string;
          wasWeakestLabel?: boolean;
          triggerSource?: string;
        };
      }[];
    },
  ) {
    const logsWithUser = body.logs.map((log) => ({
      userId: user.id,
      modelId: body.modelId,
      action: log.action,
      details: log.details,
    }));
    return this.actionLogsService.createBatch(logsWithUser);
  }

  @Get('model/:modelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy nhật ký hành vi theo model' })
  async getByModel(@Param('modelId') modelId: string) {
    return this.actionLogsService.getByModelId(modelId);
  }
}
