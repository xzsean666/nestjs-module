import { Module } from '@nestjs/common';
import { AppCoreService } from './app-core.service';

import { GlobalModule } from '../common/global.module';
import { DistributedLockModule } from '../common_modules/distributed-lock/distributed-lock.module';
import { AppCoreResolver } from './app-core.resolver';

@Module({
  imports: [GlobalModule, DistributedLockModule],
  providers: [AppCoreService, AppCoreResolver],
  exports: [AppCoreService],
})
export class AppCoreModule {}
