import { config as dotenvConfig } from 'dotenv';

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
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || 60 * 60 * 24,
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  server: {
    port: process.env.PORT || 3000,
  },
};

const devConfig = {
  // Development specific configurations
  database: {
    ...commonConfig.database,
    // Override or add dev-specific database configs
  },
  // Add other dev-specific configs
};

const prodConfig = {
  // Production specific configurations
  database: {
    ...commonConfig.database,
    // Override or add prod-specific database configs
  },
  // Add other prod-specific configs
};

const env = process.env.NODE_ENV || 'development';
const envConfig = env === 'production' ? prodConfig : devConfig;

export const config = {
  ...commonConfig,
  ...envConfig,
};
