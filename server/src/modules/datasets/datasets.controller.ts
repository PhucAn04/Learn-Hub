import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DatasetsService } from './datasets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateDatasetDto } from './dto/create-dataset.dto';

@ApiTags('Datasets')
@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo dataset mới (học sinh nộp dữ liệu huấn luyện)' })
  @ApiBody({ type: CreateDatasetDto })
  @ApiResponse({ status: 201, description: 'Tạo dataset thành công.' })
  async createDataset(@CurrentUser() user: User, @Body() dto: CreateDatasetDto) {
    return this.datasetsService.createDataset(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách dataset của học sinh hiện tại' })
  @ApiQuery({ name: 'challengeType', required: false, example: 'teach-face' })
  @ApiResponse({ status: 200, description: 'Danh sách dataset.' })
  async getMyDatasets(@CurrentUser() user: User, @Query('challengeType') challengeType?: string) {
    return this.datasetsService.getDatasetsByUser(user.id, challengeType);
  }

  @Get('by-challenge/:challengeType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giáo viên xem tất cả dataset theo loại thử thách' })
  @ApiResponse({ status: 200, description: 'Danh sách dataset theo thử thách.' })
  async getDatasetsByChallengeType(@Param('challengeType') challengeType: string) {
    return this.datasetsService.getAllDatasetsByChallengeType(challengeType);
  }

  @Get(':id/file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy nội dung file JSON của dataset' })
  @ApiResponse({ status: 200, description: 'Nội dung file dataset.' })
  async getDatasetFile(@Param('id') id: string) {
    return this.datasetsService.getDatasetFile(id);
  }
}
