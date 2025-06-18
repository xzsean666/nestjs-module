import { Module, DynamicModule, Provider } from '@nestjs/common';
import {
  SubscriptionService,
  SubscriptionConfig,
} from './subscription.service';

@Module({})
export class SubscriptionModule {
  static forRoot(config?: SubscriptionConfig): DynamicModule {
    const providers: Provider[] = [SubscriptionService];

    if (config) {
      providers.push({
        provide: 'SubscriptionConfig',
        useValue: config,
      });
    }

    return {
      module: SubscriptionModule,
      providers,
      exports: [SubscriptionService],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: SubscriptionModule,
      providers: [SubscriptionService],
      exports: [SubscriptionService],
    };
  }
}
