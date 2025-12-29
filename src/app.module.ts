import { Module, Logger, ConsoleLogger } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppResolver } from './app.resolver';
import { join } from 'path';
import { GlobalModule } from './common/global.module';
import { AuthModule } from './auth/auth.module';
import { AppCoreModule } from './app_core/app-core.module';
import { CronModule } from './common_modules/cron/cron.module';
import { CronResolver } from './app-cron.resolver';
import { FileUploadLocalModule } from './common_modules/file-upload-local/file-upload-local.module';
import { GraphQLThrottlerGuard } from './common/graphql-throttler.guard';
import { config } from './config';
import { AlertMessageService } from './common/alert.message.service';

// import { JpushModule } from './mobile_common/jpush/jpush.module';

// 根据配置构建动态导入列表
const dynamicImports: any[] = [];
if (config.fileUpload.enabled) {
  dynamicImports.push(FileUploadLocalModule);
  console.log('✓ File Upload Module is ENABLED');
} else {
  console.log('✗ File Upload Module is DISABLED');
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // 配置请求限流，防止滥用
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1秒
        limit: 100, // 每秒最多3个请求
      },
      {
        name: 'medium',
        ttl: 10000, // 10秒
        limit: 200, // 每10秒最多20个请求
      },
      {
        name: 'long',
        ttl: 60000, // 1分钟
        limit: 1000, // 每分钟最多100个请求
      },
    ]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: false, // 禁用默认 playground 以避免与自定义插件冲突
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      introspection: true,
      context: ({ req }) => ({ req }),
      installSubscriptionHandlers: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
      // 禁用 CSRF 保护，允许简单请求
      csrfPrevention: false,
      // 在 Apollo Server 4.x 中，uploads 配置已被移除，改用中间件
    } as ApolloDriverConfig),
    GlobalModule,
    AuthModule,
    AppCoreModule,
    CronModule,
    ...dynamicImports, // 动态导入模块（根据配置）
    // JpushModule,
  ],
  controllers: [],
  providers: [
    AppResolver,
    CronResolver,
    AlertMessageService,
    {
      provide: APP_GUARD,
      useClass: GraphQLThrottlerGuard,
    },
  ],
})
export class AppModule {}
