import { Module } from '@nestjs/common';
import { AiCardsService } from './ai-cards.service';

@Module({
  providers: [AiCardsService],
  exports: [AiCardsService],
})
export class AiCardsModule {}
