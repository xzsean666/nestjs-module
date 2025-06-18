import { Module } from '@nestjs/common';
import { WordflowResolver } from './wordflow.resolver';
import { WordflowService } from './wordflow.service';
import { DBService } from '../common/db.service';
import { AiService } from './ai.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionResolver } from './subscription.resolver';
import { SubscriptionCronService } from './subscription-cron.service';
import { PromoteCodeService } from './promoteCode.service';
import { PaymentModule } from '../payments/payment.module';
import { GlobalModule } from 'src/common/global.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [GlobalModule, UserModule, PaymentModule],
  controllers: [],
  providers: [
    WordflowResolver,
    WordflowService,
    DBService,
    AiService,
    SubscriptionService,
    SubscriptionResolver,
    SubscriptionCronService,
    PromoteCodeService,
  ],
  exports: [SubscriptionService, SubscriptionCronService, PromoteCodeService],
})
export class WordflowModule {}
