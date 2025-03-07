import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  database: {
    prefix: process.env.DATABASE_PREFIX || 'aibuddhism',
    url: process.env.DATABASE_URL,
  },
  server: {
    port: process.env.PORT || 3000,
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
};
