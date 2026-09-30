import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@ApiTags('Submissions & Assignments')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp kết quả bài làm/huấn luyện AI của học sinh' })
  @ApiBody({ type: CreateSubmissionDto })
  @ApiResponse({ status: 201, description: 'Nộp bài thành công.' })
  async createSubmission(
    @CurrentUser() user: User,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionsService.createSubmission(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy toàn bộ danh sách bài làm để giáo viên chấm điểm',
  })
  @ApiResponse({ status: 200, description: 'Danh sách bài nộp.' })
  async getAllSubmissions() {
    return this.submissionsService.getAllSubmissions();
  }
}
