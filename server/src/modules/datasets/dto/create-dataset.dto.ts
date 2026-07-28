import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateDatasetDto {
  @ApiProperty({ description: 'Loại thử thách', example: 'teach-face' })
  @IsString()
  challengeType: string;

  @ApiProperty({ description: 'Mảng các mẫu dữ liệu (features + thumbnail URLs)', example: [] })
  @IsArray()
  samples: Record<string, unknown>[];

  @ApiProperty({ description: 'Điểm test score tự động', example: 85 })
  @IsNumber()
  testScore: number;

  @ApiProperty({ description: 'Câu trả lời phản tư của học sinh', example: 'Con giữ tay thật im', required: false })
  @IsOptional()
  @IsString()
  reflectionAnswer?: string;

  @ApiProperty({ description: 'Đây có phải là bộ dữ liệu mẫu do giáo viên tạo?', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiProperty({ description: 'Ghi chú của giáo viên (ví dụ: cách dạy, mẹo)', example: 'Dạy bé xoay các góc', required: false })
  @IsOptional()
  @IsString()
  teacherNotes?: string;

  @ApiProperty({ description: 'Bộ dữ liệu có được xuất bản để học sinh thấy không?', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ description: 'Nguồn ảnh', example: 'webcam', required: false })
  @IsOptional()
  @IsString()
  dataSourceType?: string;

  @ApiProperty({ description: 'Nhãn tuỳ chỉnh do Giáo viên định nghĩa', example: [], required: false })
  @IsOptional()
  @IsArray()
  customClasses?: { id: string; label: string; emoji?: string }[];
}

