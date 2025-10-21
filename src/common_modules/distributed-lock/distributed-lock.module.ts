import { Module } from '@nestjs/common';
import {
  DistributedLockMemoryService,
  DistributedLockService,
} from './distributed-lock.service';
import { DBLocalService } from '../../common/db.local.service';
import { DBLocalMemoryService } from '../../common/db.local.memory.service';

@Module({
  providers: [
    DistributedLockService,
    DistributedLockMemoryService,
    DBLocalService,
    DBLocalMemoryService,
  ],
  exports: [DistributedLockService, DistributedLockMemoryService],
})
export class DistributedLockModule {}
