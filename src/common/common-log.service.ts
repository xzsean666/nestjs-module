// logger.service.ts
import { LoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';
import GelfTransport from 'winston-gelf';
import { config } from '../config/index';

console.log('config.PROJECT_NAME', config.PROJECT_NAME);

export class CommonLogger implements LoggerService {
  private logger;

  constructor() {
    // 基础传输：本地文件
    const logTransports = [
      new transports.File({
        filename: 'logs/error.log',
        level: 'error', // 只保存 error 级别
      }),
      new transports.File({
        filename: 'logs/combined.log',
      }),
    ];

    // 如果配置了 Graylog，则添加 Graylog 传输
    if (config.GRAYLOG_HOST) {
      console.log('Graylog configured, adding Graylog transport');
      logTransports.push(
        new GelfTransport({
          gelfPro: {
            fields: {
              facility: `${config.PROJECT_NAME ?? ''}${config.PUBLIC_IP ? `_${config.PUBLIC_IP}` : ''}`,
            }, // 自定义来源
            adapterName: 'udp',
            adapterOptions: {
              host: config.GRAYLOG_HOST, // Graylog server
              port: config.GRAYLOG_PORT, // Graylog GELF UDP 输入端口
            },
            environment: config.NODE_ENV,
            version: '1.0',
          },
        }),
      );
    } else {
      console.log('Graylog not configured, using local logging only');
    }

    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json(), // 本地文件保存为 JSON 格式，便于解析
      ),
      transports: logTransports,
    });

    // 如果你在开发环境，也想看到 console 日志
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
      );
    }
  }

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace?: string) {
    this.logger.error(message, { trace });
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
