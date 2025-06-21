import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AppResolver } from './app.resolver';
import { join } from 'path';
import { GlobalModule } from './common/global.module';
import { AuthModule } from './auth/auth.module';
// import { JpushModule } from './mobile_common/jpush/jpush.module';

@Module({
  imports: [
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
    } as ApolloDriverConfig),
    GlobalModule,
    AuthModule,
    // JpushModule,
  ],
  controllers: [],
  providers: [AppResolver],
})
export class AppModule {}
