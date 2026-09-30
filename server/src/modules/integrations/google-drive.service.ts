import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_CALLBACK_URL'),
    );
  }

  private getDriveClient(accessToken: string): drive_v3.Drive {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async ensureAppFolder(
    accessToken: string,
    folderName: string = 'Learn-Hub',
  ): Promise<string> {
    const drive = this.getDriveClient(accessToken);
    try {
      const response = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      // Create folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const file = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      return file.data.id!;
    } catch (error) {
      this.logger.error(`Failed to ensure app folder: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    accessToken: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    parentFolderId?: string,
  ): Promise<string> {
    const drive = this.getDriveClient(accessToken);
    const folderId =
      parentFolderId || (await this.ensureAppFolder(accessToken));

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: mimeType,
      body: Readable.from(fileBuffer),
    };

    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
      });

      // Optional: Make it readable by anyone with the link
      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return response.data.webViewLink || response.data.webContentLink || '';
    } catch (error) {
      this.logger.error(
        `Failed to upload file to Google Drive: ${error.message}`,
      );
      throw error;
    }
  }

  async uploadImage(
    accessToken: string,
    imageBuffer: Buffer,
    fileName: string,
    parentFolderId?: string,
  ): Promise<string> {
    return this.uploadFile(
      accessToken,
      imageBuffer,
      fileName,
      'image/jpeg',
      parentFolderId,
    );
  }

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    fileName: string,
    parentFolderId?: string,
  ): Promise<string> {
    return this.uploadFile(
      accessToken,
      videoBuffer,
      fileName,
      'video/mp4',
      parentFolderId,
    );
  }
}
