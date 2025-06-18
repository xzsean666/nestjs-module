import { Module, Global } from '@nestjs/common';
import { JpushService } from './jpush.service';
import { jpushConfig, validateJpushConfig } from './jpush.config';
import { JpushResolver } from './jpush.resolver';

@Global()
@Module({
  providers: [
    {
      provide: JpushService,
      useFactory: () => {
        validateJpushConfig();
        return new JpushService(jpushConfig);
      },
    },
    JpushResolver,
  ],
  exports: [JpushService],
})
export class JpushModule {}
