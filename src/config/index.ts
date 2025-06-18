import { config as dotenvConfig } from 'dotenv';

interface AppConfig {
  database: {
    prefix: string;
    url: string;
  };
  auth: {
    ADMIN_AUTH_CODE: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: number;
  };
  supabase: {
    url: string;
    key: string;
  };
  server: {
    port: string | number;
  };
  wechat: {
    WECHAT_APP_ID: string;
    WECHAT_APP_SECRET: string;
  };
  word_flow: { study_ratio: number[] };
  GEMINI_API_KEY: string;
  GEMINI_API_KEYS: string[];
  LIMIT_BATCH_WORDS: number;
  proxyUrl?: string; // Make proxyUrl optional
  pricing: {
    monthly_price: number;
    quarterly_discount: number;
    yearly_discount: number;
  };
}

dotenvConfig();

const commonConfig = {
  database: {
    prefix: process.env.DATABASE_PREFIX || 'word_flow',
    url:
      process.env.DATABASE_URL ||
      'postgresql://sean:111111@localhost:5432/MyDB',
  },
  auth: {
    ADMIN_AUTH_CODE: process.env.ADMIN_AUTH_CODE || '666',
    JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret',
    JWT_EXPIRES_IN: Number(process.env.JWT_EXPIRES_IN) || 60 * 60 * 24 * 15,
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  server: {
    port: process.env.PORT || 3000,
  },
  wechat: {
    WECHAT_APP_ID: process.env.WECHAT_APP_ID || '',
    WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET || '',
  },
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_API_KEYS: JSON.parse(process.env.GEMINI_API_KEYS || '[]'),
  LIMIT_BATCH_WORDS: process.env.LIMIT_BATCH_WORDS || 30,
  word_flow: {
    study_ratio: process.env.STUDY_RATIO
      ? process.env.STUDY_RATIO.split(',').map(Number)
      : [4, 2, 1],
  },
  pricing: {
    monthly_price: process.env.MONTHLY_PRICE || 9.99,
    quarterly_discount: process.env.QUARTERLY_DISCOUNT || 0.15,
    yearly_discount: process.env.YEARLY_DISCOUNT || 0.25,
  },
};

const devConfig: Partial<AppConfig> = {
  // Development specific configurations
  database: {
    ...commonConfig.database,
    // Override or add dev-specific database configs
  },
  proxyUrl: process.env.PROXY_URL || 'http://127.0.0.1:7897',
  // Add other dev-specific configs
};

const prodConfig: Partial<AppConfig> = {
  // Production specific configurations
  database: {
    ...commonConfig.database,
    // Override or add prod-specific database configs
  },
  // Add other prod-specific configs
};

const env = process.env.NODE_ENV || 'dev';
const envConfig = env === 'prod' ? prodConfig : devConfig;

export const config: AppConfig = {
  ...commonConfig,
  ...envConfig,
} as AppConfig; // Cast to AppConfig
