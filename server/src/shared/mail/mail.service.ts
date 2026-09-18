import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    // Basic nodemailer transport configuration.
    // In production, these should come from ConfigService / Environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      auth: {
        user: process.env.SMTP_USER || 'ethereal_user',
        pass: process.env.SMTP_PASS || 'ethereal_pass',
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Learn-Hub: Yêu cầu đặt lại mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Hệ thống đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p>Vui lòng click vào đường link dưới đây để thiết lập mật khẩu mới (link có hiệu lực trong 15 phút):</p>
        <p>
          <a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
        </p>
        <p>Nếu bạn không thể click vào nút trên, hãy copy đường dẫn sau và dán vào trình duyệt:</p>
        <p><em>${resetLink}</em></p>
        <hr />
        <p style="font-size: 12px; color: #888;">Nếu bạn không yêu cầu điều này, xin vui lòng bỏ qua email này.</p>
      </div>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: '"Learn-Hub Admin" <no-reply@learn-hub.com>',
        to,
        subject: 'Learn-Hub: Thiết lập lại mật khẩu của bạn',
        html: htmlContent,
      });

      this.logger.log(`Email sent successfully: ${info.messageId}`);

      // ethereal log for dev
      if (
        process.env.SMTP_HOST === 'smtp.ethereal.email' ||
        !process.env.SMTP_HOST
      ) {
        this.logger.log(
          `Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error('Error sending password reset email', error);
      throw new Error('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    }
  }
}
