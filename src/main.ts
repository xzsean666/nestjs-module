import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { graphqlUploadExpress } from 'graphql-upload-minimal';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用 gzip 压缩以减小响应体积，提升传输速度
  app.use(
    compression({
      filter: (req, res) => {
        // 对所有请求启用压缩，除非响应头中明确指定不压缩
        if (req.headers['x-no-compression']) {
          return false;
        }
        // 使用 compression 默认的过滤器
        return compression.filter(req, res);
      },
      // 设置压缩级别 (1-9, 6为默认值，平衡压缩率和速度)
      level: 6,
      // 只对大于1KB的响应进行压缩
      threshold: 1024,
      // 设置内存使用级别 (1-9, 8为默认值)
      memLevel: 8,
      // 压缩窗口大小 (9-15, 15为默认值，更大的窗口提供更好的压缩率)
      windowBits: 15,
    }),
  );

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

  // app.enableCors(corsOptions);
  app.enableCors({
    origin: '*',
    credentials: false,
  });
  app.use(graphqlUploadExpress());

  // 优先使用环境变量中的端口（PM2 会设置），然后是配置文件中的端口
  const port = process.env.PORT || config.server.port || 3000;

  // 在集群模式下，PM2 会处理端口监听和负载均衡
  // 每个工作进程只需要监听，PM2 会自动处理端口分配
  await app.listen(port);

  // 添加进程信息日志，便于调试
  const processInfo = process.env.pm_id
    ? `[Worker ${process.env.pm_id}]`
    : '[Standalone]';
  console.log(
    `${processInfo} Server is running on port ${port} with gzip compression enabled`,
  );
}

bootstrap().catch((err) => {
  console.error(err);
});
