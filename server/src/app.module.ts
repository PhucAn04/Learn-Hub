import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './shared/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { ModelsModule } from './modules/models/models.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ActionLogsModule } from './modules/action-logs/action-logs.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProgressModule,
    SubmissionsModule,
    DatasetsModule,
    ModelsModule,
    IntegrationsModule,
    ActionLogsModule,
    AssessmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
