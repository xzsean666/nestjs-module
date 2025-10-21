import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';
import { DBLocalService } from './db.local.service';
import { DBLocalMemoryService } from './db.local.memory.service';

@Global()
@Module({
  providers: [DBService, DBLocalService, DBLocalMemoryService],
  exports: [DBService, DBLocalService, DBLocalMemoryService],
})
export class GlobalModule {}
