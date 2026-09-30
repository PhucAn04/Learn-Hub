import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionLog } from './entities/action-log.entity';
import { ActionLogsService } from './action-logs.service';
import { ActionLogsController } from './action-logs.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([ActionLog]), AuthModule, UsersModule],
  controllers: [ActionLogsController],
  providers: [ActionLogsService],
  exports: [ActionLogsService],
})
export class ActionLogsModule {}
