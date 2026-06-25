import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SaveProgressDto } from './dto/progress.dto';

@ApiTags('Progress & Leaderboard')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lưu điểm số thử thách mới của bé' })
  @ApiBody({ type: SaveProgressDto })
  @ApiResponse({ status: 201, description: 'Lưu điểm thành công.' })
  async saveProgress(@CurrentUser() user: User, @Body() dto: SaveProgressDto) {
    return this.progressService.saveProgress(user.id, dto.challengeType, dto.score);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem điểm cao nhất của bé ở từng thử thách' })
  @ApiResponse({ status: 200, description: 'Điểm số cao nhất.' })
  async getUserStats(@CurrentUser() user: User) {
    return this.progressService.getUserStats(user.id);
  }

  @Get('leaderboard/:challengeType')
  @ApiOperation({ summary: 'Lấy bảng xếp hạng Top 10 của thử thách' })
  @ApiResponse({ status: 200, description: 'Danh sách Top 10.' })
  async getLeaderboard(@Param('challengeType') challengeType: string) {
    return this.progressService.getLeaderboard(challengeType);
  }
}
