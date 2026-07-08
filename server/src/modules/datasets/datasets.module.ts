import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dataset } from './entities/dataset.entity';
import { Model } from '../models/entities/model.entity';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dataset, Model]),
    AuthModule,
    UsersModule,
  ],
  providers: [DatasetsService],
  controllers: [DatasetsController],
  exports: [DatasetsService],
})
export class DatasetsModule {}
