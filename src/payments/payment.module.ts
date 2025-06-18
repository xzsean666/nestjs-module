import { Module, forwardRef } from '@nestjs/common';
import { UnitPayService } from './unitPay.service';
import { PaymentController } from './controllers/payment.controller';
import { DBService } from '../common/db.service';
import { GlobalModule } from '../common/global.module';

@Module({
  imports: [GlobalModule],
  controllers: [PaymentController],
  providers: [
    UnitPayService,
    DBService,
    {
      provide: 'SUBSCRIPTION_SERVICE',
      useFactory: () => {
        // 使用动态导入避免循环依赖
        return null; // 在实际运行时会被 WordflowModule 注入
      },
    },
  ],
  exports: [UnitPayService],
})
export class PaymentModule {}
