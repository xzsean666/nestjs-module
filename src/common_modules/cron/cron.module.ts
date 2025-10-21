import { Module } from '@nestjs/common';
import { CronManagerService } from './cron-manager.service';
import { AppCronService } from '../../app-cron.service';
import { AppCoreModule } from '../../app_core/app-core.module';
import { DistributedLockModule } from '../distributed-lock';

@Module({
  imports: [AppCoreModule, DistributedLockModule],
  providers: [CronManagerService, AppCronService],
  exports: [CronManagerService, AppCronService],
})
export class CronModule {}
