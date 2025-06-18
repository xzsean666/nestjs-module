import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AppResolver } from './app.resolver';
import { join } from 'path';
import { GlobalModule } from './common/global.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WordflowModule } from './wordflow/wordflow.module';
import { JpushModule } from './mobile_common/jpush/jpush.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      playground: false,
      context: ({ req }) => ({ req }),
      installSubscriptionHandlers: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
    } as ApolloDriverConfig),
    GlobalModule,
    JpushModule,
    AuthModule,
    UserModule,
    WordflowModule,
  ],
  controllers: [],
  providers: [AppResolver],
})
export class AppModule {}
