import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Tên hiển thị của bé', example: 'Phúc Ân' })
  username: string;

  @ApiProperty({
    description: 'Địa chỉ Email đăng nhập',
    example: 'an@gmail.com',
  })
  email: string;

  @ApiProperty({ description: 'Mật khẩu', example: '123456' })
  password: string;

  @ApiProperty({
    description: 'Hình đại diện (Emoji ngộ nghĩnh)',
    example: '🦊',
    required: false,
  })
  avatar: string;

  @ApiProperty({
    description: 'Vai trò (student hoặc teacher)',
    example: 'student',
    required: false,
    default: 'student',
  })
  role: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Địa chỉ Email đăng nhập',
    example: 'an@gmail.com',
  })
  email: string;

  @ApiProperty({ description: 'Mật khẩu', example: '123456' })
  password: string;
}
