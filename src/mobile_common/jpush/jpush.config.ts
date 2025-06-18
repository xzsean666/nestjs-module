import { JpushConfig } from './jpush.service';

export const jpushConfig: JpushConfig = {
  appKey: process.env.JPUSH_APP_KEY || '1234567890',
  masterSecret: process.env.JPUSH_MASTER_SECRET || '1234567890',
  apnsProduction: process.env.NODE_ENV === 'production', // 生产环境使用生产证书
  timeToLive: parseInt(process.env.JPUSH_TIME_TO_LIVE || '86400'), // 默认1天
};

// 验证配置
export function validateJpushConfig(): void {
  if (!jpushConfig.appKey) {
    throw new Error('JPUSH_APP_KEY environment variable is required');
  }

  if (!jpushConfig.masterSecret) {
    throw new Error('JPUSH_MASTER_SECRET environment variable is required');
  }

  if (
    !jpushConfig.timeToLive ||
    jpushConfig.timeToLive <= 0 ||
    jpushConfig.timeToLive > 864000
  ) {
    throw new Error('JPUSH_TIME_TO_LIVE must be between 1 and 864000 seconds');
  }
}
