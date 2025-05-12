import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { graphqlUploadExpress } from 'graphql-upload-minimal';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 CORS，严格拦截未授权的请求
  const corsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://astake.dev',
        'https://*.astake.dev',
        'http://localhost:5173',
        'http://localhost:3001',
        'https://stag.d3e67q7i881vjf.amplifyapp.com',
        'https://main.d3e67q7i881vjf.amplifyapp.com',
      ];

      // 检查是否是预检请求
      if (!origin) {
        callback(null, true);
        return;
      }

      // 检查是否匹配允许的域名
      const isAllowed = allowedOrigins.some((allowed) => {
        const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
        return pattern.test(origin);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        // GraphQL 会将这个响应转换为适当的错误格式
        // const error = new Error('CORS policy violation');
        // callback(null, true);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-apollo-operation-name',
      'apollo-require-preflight',
    ],
  };

  app.enableCors(corsOptions);
  // app.enableCors({
  //   origin: '*',
  //   credentials: false,
  // });
  app.use(graphqlUploadExpress());

  const port = config.server.port || 3000;

  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
});
