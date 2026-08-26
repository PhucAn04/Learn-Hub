import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  VerifyCallback,
  Profile,
  StrategyOptions,
} from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID:
        configService.get<string>('GOOGLE_CLIENT_ID') || 'placeholder_id',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        'placeholder_secret',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
      accessType: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to get refresh token
    } as StrategyOptions);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos, id } = profile;
    const user = {
      email: emails?.[0]?.value ?? '',
      firstName: name?.givenName ?? '',
      lastName: name?.familyName ?? '',
      picture: photos?.[0]?.value ?? '',
      googleId: id,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
