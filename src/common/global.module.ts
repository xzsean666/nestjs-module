import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';
import { DBLocalService } from './db.local.service';

@Global()
@Module({
  providers: [DBService, DBLocalService],
  exports: [DBService, DBLocalService],
})
export class GlobalModule {}
