import { ApiProperty } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({
    description: 'Độ chính xác của mô hình tự đánh giá (%)',
    example: 90,
  })
  accuracy: number;

  @ApiProperty({
    description: 'Bộ dữ liệu tọa độ khớp xương tay đã chụp',
    example: {},
  })
  dataset?: Record<string, unknown>;

  @ApiProperty({
    description: 'Câu trả lời tự luận phản tư của học sinh',
    example: 'Con giữ tay im lặng khi chụp',
  })
  reflectionAnswer?: string;

  @ApiProperty({ description: 'Loại thử thách', example: 'teach' })
  challengeType?: string;
}
