import { ApiProperty } from '@nestjs/swagger';

export class CreateDatasetDto {
  @ApiProperty({ description: 'Loại thử thách', example: 'teach-face' })
  challengeType: string;

  @ApiProperty({ description: 'Mảng các mẫu dữ liệu (features + thumbnail URLs)', example: [] })
  samples: any[];

  @ApiProperty({ description: 'Điểm test score tự động', example: 85 })
  testScore: number;

  @ApiProperty({ description: 'Câu trả lời phản tư của học sinh', example: 'Con giữ tay thật im', required: false })
  reflectionAnswer?: string;
}
