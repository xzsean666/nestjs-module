import { config as dotenvConfig } from 'dotenv';
import {
  parseApiKeys,
  parseNumericEnv,
  parsePricingConfig,
  parseBooleanEnv,
} from './env-parser.helper';

export interface AlertRuleConfig {
  minLevel: number;
  maxLevel?: number;
  repeatCount: number;
  repeatIntervalSeconds: number;
}

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
  instance_logs: boolean;
  GEMINI_API_KEY: string;
  GEMINI_API_KEYS: string[];
  LIMIT_BATCH_WORDS: number;
  proxyUrl?: string; // Make proxyUrl optional
  pricing: {
    monthly_price: number;
    quarterly_discount: number;
    yearly_discount: number;
  };
  MAX_INSTANCE_COUNT: number;
  GATEWAY_API_TOKEN: string;
  GRAYLOG_HOST?: string;
  GRAYLOG_PORT?: string;
  NODE_ENV?: string;
  PROJECT_NAME?: string;
  PUBLIC_IP?: string;
  fileUpload: {
    enabled: boolean;
  };
  ALERT_CONFIG?: {
    SLACK_WEBHOOK_URL?: string;
    DING_WEBHOOK_URL?: string;
    DING_WEBHOOK_SECRET?: string;
    FEISHU_WEBHOOK_URL?: string;
    FEISHU_WEBHOOK_SECRET?: string;
    HOST_NAME?: string;
    REPEAT_COUNT?: number;
    REPEAT_INTERVAL?: number;
    rules?: AlertRuleConfig[];
  };
}

dotenvConfig();

const defaultAlertRules: AlertRuleConfig[] = [
  {
    minLevel: 60,
    maxLevel: 80,
    repeatCount: 1,
    repeatIntervalSeconds: 60,
  },
  {
    minLevel: 80,
    repeatCount: 3,
    repeatIntervalSeconds: 10,
  },
];

function loadAlertRules(): AlertRuleConfig[] {
  const rawRules = process.env.ALERT_RULES;
  if (!rawRules) {
    return defaultAlertRules;
  }

  try {
    const parsed = JSON.parse(rawRules);
    if (!Array.isArray(parsed)) {
      return defaultAlertRules;
    }

    const normalized = parsed
      .map((rule) => {
        const minLevel = Number(rule.minLevel ?? rule.min);
        const maxValue = rule.maxLevel ?? rule.max;
        const repeatCount = Number(rule.repeatCount ?? rule.repeat);
        const repeatIntervalSeconds = Number(
          rule.repeatIntervalSeconds ??
            rule.repeatInterval ??
            rule.intervalSeconds ??
            rule.interval,
        );

        if (!Number.isFinite(minLevel) || !Number.isFinite(repeatCount)) {
          return null;
        }

        const maxLevel = Number(maxValue);
        return {
          minLevel,
          maxLevel: Number.isFinite(maxLevel) ? maxLevel : undefined,
          repeatCount,
          repeatIntervalSeconds: Number.isFinite(repeatIntervalSeconds)
            ? repeatIntervalSeconds
            : 60,
        } as AlertRuleConfig;
      })
      .filter((rule): rule is AlertRuleConfig => !!rule);

    return normalized.length ? normalized : defaultAlertRules;
  } catch (error) {
    console.warn('Failed to parse ALERT_RULES, using default alert rules', {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultAlertRules;
  }
}

const commonConfig = {
  database: {
    prefix: process.env.PROJECT_NAME || 'ai_persona',
    url:
      process.env.DATABASE_URL ||
      'postgresql://sean:111111@localhost:5432/MyDB',
  },
  auth: {
    ADMIN_AUTH_CODE: process.env.ADMIN_AUTH_CODE || '666',
    JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret',
    JWT_EXPIRES_IN: parseNumericEnv(
      process.env.JWT_EXPIRES_IN,
      60 * 60 * 24 * 15,
    ),
    JWT_FILE_UPLOAD_SECRET:
      process.env.JWT_FILE_UPLOAD_SECRET || 'default-jwt-file-upload-secret',
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
  MAX_INSTANCE_COUNT: parseNumericEnv(process.env.MAX_INSTANCE_COUNT, 30),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_API_KEYS: parseApiKeys(process.env.GEMINI_API_KEY),
  LIMIT_BATCH_WORDS: parseNumericEnv(process.env.LIMIT_BATCH_WORDS, 30),

  pricing: parsePricingConfig(),
  GATEWAY_API_TOKEN: process.env.GATEWAY_API_TOKEN || '',
  GRAYLOG_HOST: process.env.GRAYLOG_HOST,
  GRAYLOG_PORT: process.env.GRAYLOG_PORT || '12201',
  PROJECT_NAME: process.env.PROJECT_NAME,
  PUBLIC_IP: process.env.PUBLIC_IP,
  fileUpload: {
    enabled: parseBooleanEnv(process.env.ENABLE_FILE_UPLOAD, false),
  },
  ALERT_CONFIG: {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    DING_WEBHOOK_URL: process.env.DING_WEBHOOK_URL,
    DING_WEBHOOK_SECRET: process.env.DING_WEBHOOK_SECRET,
    FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL,
    FEISHU_WEBHOOK_SECRET: process.env.FEISHU_WEBHOOK_SECRET,
    HOST_NAME: process.env.HOST_NAME,
    rules: loadAlertRules(),
  },
};

const devConfig: Partial<AppConfig> = {
  // Development specific configurations
  database: {
    ...commonConfig.database,
    // Override or add dev-specific database configs
  },
  proxyUrl: process.env.PROXY_URL,
  // Add other dev-specific configs
};

const prodConfig: Partial<AppConfig> = {
  // Production specific configurations
  database: {
    ...commonConfig.database,
    // Override or add prod-specific database configs
  },
  instance_logs: true,
  // Add other prod-specific configs
};

const env = process.env.NODE_ENV || 'dev';
const envConfig = env === 'production' ? prodConfig : devConfig;

export const config: AppConfig = {
  ...commonConfig,
  ...envConfig,
} as AppConfig; // Cast to AppConfig
