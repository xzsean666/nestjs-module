import { Module } from '@nestjs/common';
import { SystemMessageService } from './system-message.service';

@Module({
  providers: [SystemMessageService],
  exports: [SystemMessageService],
})
export class SystemMessageModule {}
