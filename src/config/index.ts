import { config as dotenvConfig } from 'dotenv';

dotenvConfig();
export const config = {
  database: {
    prefix: process.env.DATABASE_PREFIX || '',
    url:
      process.env.DATABASE_URL ||
      'postgresql://sean:111111@localhost:5432/MyDB',
  },
  auth: {
    ADMIN_AUTH_CODE: process.env.ADMIN_AUTH_CODE || '666',
  },
  server: {
    port: process.env.PORT || 3000,
  },
};
