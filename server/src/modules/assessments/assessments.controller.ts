import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Assessments')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo/cập nhật đánh giá kỹ năng cho một challenge' })
  @ApiResponse({ status: 201, description: 'Đánh giá đã được lưu.' })
  async upsert(
    @CurrentUser() user: User,
    @Body()
    body: {
      challengeType: string;
      modelChain: {
        modelId: string;
        version: number;
        testScore: number;
        sampleCount: number;
        classSummary: Record<string, number>;
      }[];
      dataCurationScore: number;
      debuggingScore: number;
      improvementScore: number;
      overallScore: number;
      narrative?: {
        summary: string;
        strengths: string[];
        improvements: string[];
      };
    },
  ) {
    return this.assessmentsService.upsert(user.id, body.challengeType, body);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy đánh giá kỹ năng của học sinh hiện tại' })
  async getMyAssessments(@CurrentUser() user: User) {
    return this.assessmentsService.getByUser(user.id);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giáo viên: Lấy tất cả đánh giá của học sinh' })
  async getAllAssessments() {
    return this.assessmentsService.getAllForTeacher();
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giáo viên: Lấy đánh giá của một học sinh cụ thể' })
  findByUser(@Param('userId') userId: string) {
    return this.assessmentsService.getByUser(userId);
  }
}
