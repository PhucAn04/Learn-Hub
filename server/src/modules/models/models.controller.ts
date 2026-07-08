import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ModelsService } from './models.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Models')
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách model của học sinh hiện tại' })
  @ApiQuery({ name: 'challengeType', required: false, example: 'teach-face' })
  @ApiResponse({ status: 200, description: 'Danh sách model.' })
  async getMyModels(@CurrentUser() user: User, @Query('challengeType') challengeType?: string) {
    return this.modelsService.getModelsByUser(user.id, challengeType);
  }

  @Patch(':id/feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giáo viên thêm phản hồi cho model của học sinh' })
  @ApiResponse({ status: 200, description: 'Cập nhật phản hồi thành công.' })
  async addFeedback(@Param('id') id: string, @Body('feedback') feedback: string) {
    return this.modelsService.addTeacherFeedback(id, feedback);
  }
}
