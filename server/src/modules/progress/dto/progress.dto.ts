import { ApiProperty } from '@nestjs/swagger';

export class SaveProgressDto {
  @ApiProperty({
    description: 'Loại thử thách',
    example: 'fingers',
    enum: ['fingers', 'gestures', 'face'],
  })
  challengeType: string;

  @ApiProperty({ description: 'Điểm số đạt được', example: 50 })
  score: number;
}
