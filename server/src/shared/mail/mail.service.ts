import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private initialized = false;

  private async ensureTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter && this.initialized) {
      return this.transporter;
    }

    // Nếu đã cấu hình SMTP thực (production)
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_HOST !== 'smtp.ethereal.email'
    ) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.initialized = true;
      this.logger.log(`SMTP configured: ${process.env.SMTP_HOST}`);
      return this.transporter;
    }

    // Dev mode: tự động tạo tài khoản Ethereal test
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.initialized = true;
      this.logger.log(`Ethereal test account created: ${testAccount.user}`);
      return this.transporter;
    } catch {
      this.logger.warn(
        'Cannot create Ethereal account, using console fallback',
      );
      this.initialized = true;
      return null as unknown as nodemailer.Transporter;
    }
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

    const transporter = await this.ensureTransporter();

    // Fallback: nếu không tạo được transporter, chỉ log ra console
    if (!transporter) {
      this.logger.warn(`=== PASSWORD RESET EMAIL (console fallback) ===`);
      this.logger.warn(`To: ${to}`);
      this.logger.warn(`Reset Link: ${resetLink}`);
      this.logger.warn(`==============================================`);
      return true;
    }

    try {
      const info = await transporter.sendMail({
        from: '"Learn-Hub Admin" <no-reply@learn-hub.com>',
        to,
        subject: 'Learn-Hub: Thiết lập lại mật khẩu của bạn',
        html: htmlContent,
      });

      this.logger.log(`Email sent successfully: ${info.messageId}`);

      // Ethereal preview URL cho dev
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`📧 Ethereal Preview URL: ${previewUrl}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Error sending password reset email', error);

      // Trong dev mode, log link ra console thay vì throw error
      this.logger.warn(`=== FALLBACK: PASSWORD RESET LINK ===`);
      this.logger.warn(`To: ${to}`);
      this.logger.warn(`Reset Link: ${resetLink}`);
      this.logger.warn(`=====================================`);
      return true;
    }
  }
}
