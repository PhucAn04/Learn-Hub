import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Tên hiển thị của bé', example: 'Phúc Ân' })
  username: string = '';

  @ApiProperty({
    description: 'Địa chỉ Email đăng nhập',
    example: '2200004202@nttu.edu.vn',
  })
  email: string = '';

  @ApiProperty({ description: 'Mật khẩu', example: '123456' })
  password: string = '';

  @ApiProperty({
    description: 'Hình đại diện (Emoji ngộ nghĩnh)',
    example: '🦊',
    required: false,
  })
  avatar: string = '';

  @ApiProperty({
    description: 'Vai trò (student hoặc teacher)',
    example: 'student',
    required: false,
    default: 'student',
  })
  role: string = 'student';
}

export class LoginDto {
  @ApiProperty({
    description: 'Địa chỉ Email đăng nhập',
    example: '2200004202@nttu.edu.vn',
  })
  email: string = '';

  @ApiProperty({ description: 'Mật khẩu', example: '123456' })
  password: string = '';
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Địa chỉ Email để nhận link',
    example: '2200004202@nttu.edu.vn',
  })
  email: string = '';
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token khôi phục',
    example: 'token-abc',
  })
  token: string = '';

  @ApiProperty({ description: 'Mật khẩu mới', example: '123456' })
  newPassword: string = '';
}
