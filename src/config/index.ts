import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  database: {
    url: process.env.DATABASE_URL,
  },
  server: {
    port: process.env.PORT || 3000,
  },
};
