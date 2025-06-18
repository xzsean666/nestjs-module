import { Module } from '@nestjs/common';
import { PromoteCodeService } from './promote-code.service';

@Module({
  providers: [PromoteCodeService],
  exports: [PromoteCodeService],
})
export class PromoteCodeModule {}
