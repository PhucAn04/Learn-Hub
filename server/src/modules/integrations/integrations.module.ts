import { Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { CloudinaryService } from './cloudinary.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [GoogleDriveService, CloudinaryService],
  exports: [GoogleDriveService, CloudinaryService],
})
export class IntegrationsModule {}
