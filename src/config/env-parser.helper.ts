/**
 * 环境变量解析工具函数
 * 用于处理各种格式的环境变量，特别是JSON和数组格式
 */

export interface ParseEnvOptions {
  /** 是否启用调试日志 */
  enableLogging?: boolean;
  /** 回退值 */
  fallbackValue?: any;
  /** 回退环境变量名 */
  fallbackEnvKey?: string;
}

/**
 * 解析可能是JSON格式的环境变量
 * 支持多种格式：标准JSON、类JSON（缺少引号）、单值等
 */
export function parseJsonEnv(
  envValue: string | undefined,
  options: ParseEnvOptions = {},
): any[] {
  const { enableLogging = false, fallbackValue = [], fallbackEnvKey } = options;

  const log = (message: string, data?: any) => {
    if (enableLogging) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  };

  const warn = (message: string, data?: any) => {
    if (enableLogging) {
      if (data !== undefined) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  };

  try {
    const rawValue = envValue || '[]';
    log('Environment variable raw value:', JSON.stringify(rawValue));

    // 清理环境变量值，移除可能的引号和转义字符
    let cleanValue = rawValue.trim();

    // 移除外层引号
    if (
      (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
      (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
    ) {
      cleanValue = cleanValue.slice(1, -1);
    }

    // 处理转义字符
    cleanValue = cleanValue.replace(/\\"/g, '"').replace(/\\'/g, "'");

    log('Environment variable cleaned value:', JSON.stringify(cleanValue));

    // 如果清理后的值为空，返回默认值
    if (!cleanValue || cleanValue === '[]') {
      log('Empty value, returning fallback');
      return fallbackValue;
    }

    // 如果不是JSON格式（不以[或{开头），作为单个值处理
    if (!cleanValue.startsWith('[') && !cleanValue.startsWith('{')) {
      log('Treating as single value');
      return [cleanValue];
    }

    // 尝试修复类JSON格式（缺少引号的数组）
    if (cleanValue.startsWith('[') && cleanValue.endsWith(']')) {
      try {
        // 先尝试直接解析
        const parsed = JSON.parse(cleanValue);
        log(
          'Successfully parsed as JSON:',
          Array.isArray(parsed)
            ? `Array with ${parsed.length} items`
            : typeof parsed,
        );
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (firstError) {
        log('Direct JSON parse failed, trying to fix format...');
        // 如果直接解析失败，尝试修复格式
        const fixedValue = cleanValue
          .slice(1, -1) // 移除方括号
          .split(',') // 按逗号分割
          .map((item) => item.trim()) // 去除空格
          .filter((item) => item.length > 0); // 过滤空值

        log('Fixed array format:', `Array with ${fixedValue.length} items`);
        return fixedValue;
      }
    }

    // 如果到达这里，说明格式不被支持
    throw new Error(`Unsupported environment variable format: ${cleanValue}`);
  } catch (error) {
    warn('Failed to parse environment variable, details:', {
      error: error.message,
      rawValue: envValue,
      fallbackEnvKey: fallbackEnvKey,
      hasFallback: !!fallbackEnvKey,
    });

    // 尝试使用回退环境变量
    if (fallbackEnvKey) {
      const fallbackEnvValue = process.env[fallbackEnvKey];
      if (fallbackEnvValue) {
        log(`Using fallback environment variable: ${fallbackEnvKey}`);
        return [fallbackEnvValue];
      }
    }

    log('No valid value found, returning fallback value');
    return fallbackValue;
  }
}

/**
 * 解析API密钥数组
 * 专门用于处理API密钥的环境变量
 */
export function parseApiKeys(
  apiKeysEnv: string | undefined,
  fallbackEnvKey?: string,
  enableLogging = false,
): string[] {
  return parseJsonEnv(apiKeysEnv, {
    enableLogging,
    fallbackValue: [],
    fallbackEnvKey,
  });
}

/**
 * 安全的数字解析
 */
export function parseNumericEnv(
  envValue: string | undefined,
  defaultValue: number,
  enableLogging = false,
): number {
  if (!envValue) {
    return defaultValue;
  }

  const parsed = Number(envValue);
  if (isNaN(parsed)) {
    if (enableLogging) {
      console.warn(
        `Invalid numeric environment variable: ${envValue}, using default: ${defaultValue}`,
      );
    }
    return defaultValue;
  }

  return parsed;
}

/**
 * 安全的布尔值解析
 */
export function parseBooleanEnv(
  envValue: string | undefined,
  defaultValue: boolean = false,
): boolean {
  if (!envValue) {
    return defaultValue;
  }

  const normalized = envValue.toLowerCase().trim();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

/**
 * 解析定价配置
 */
export function parsePricingConfig(enableLogging = false) {
  return {
    monthly_price: parseNumericEnv(
      process.env.MONTHLY_PRICE,
      9.99,
      enableLogging,
    ),
    quarterly_discount: parseNumericEnv(
      process.env.QUARTERLY_DISCOUNT,
      0.15,
      enableLogging,
    ),
    yearly_discount: parseNumericEnv(
      process.env.YEARLY_DISCOUNT,
      0.25,
      enableLogging,
    ),
  };
}
