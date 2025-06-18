import { Module } from '@nestjs/common';
import { UserMetaService } from './user-meta.service';

@Module({
  providers: [UserMetaService],
  exports: [UserMetaService],
})
export class UserMetaModule {}
