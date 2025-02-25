import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 启用 CORS，允许所有来源
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = config.server.port || 3000;

  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
});
