import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

// 极光推送配置接口
export interface JpushConfig {
  appKey: string;
  masterSecret: string;
  apnsProduction?: boolean; // iOS推送环境，默认false（开发环境）
  timeToLive?: number; // 消息存活时间（秒），默认86400（1天）
}

// 推送平台
export type Platform = 'android' | 'ios' | 'all';

// 推送目标
export interface Audience {
  all?: boolean;
  tag?: string[];
  tag_and?: string[];
  tag_not?: string[];
  alias?: string[];
  registration_id?: string[];
  segment?: string[];
  abtest?: string[];
}

// 通知内容
export interface Notification {
  alert?: string;
  android?: {
    alert?: string;
    title?: string;
    builder_id?: number;
    priority?: number;
    category?: string;
    style?: number;
    alert_type?: number;
    big_text?: string;
    inbox?: string[];
    big_pic_path?: string;
    extras?: Record<string, any>;
    large_icon?: string;
    intent?: Record<string, any>;
  };
  ios?: {
    alert?:
      | string
      | {
          title?: string;
          body?: string;
          subtitle?: string;
          action_loc_key?: string;
          loc_key?: string;
          loc_args?: string[];
          launch_image?: string;
        };
    badge?: number | string;
    sound?: string;
    content_available?: boolean;
    mutable_content?: boolean;
    category?: string;
    extras?: Record<string, any>;
    thread_id?: string;
  };
}

// 自定义消息
export interface Message {
  msg_content: string;
  title?: string;
  content_type?: string;
  extras?: Record<string, any>;
}

// 推送选项
export interface Options {
  sendno?: number;
  time_to_live?: number;
  override_msg_id?: number;
  apns_production?: boolean;
  apns_collapse_id?: string;
  big_push_duration?: number;
  classification?: number;
}

// 推送请求体
export interface PushPayload {
  platform: Platform | Platform[];
  audience: Audience;
  notification?: Notification;
  message?: Message;
  sms_message?: {
    delay_time?: number;
    signid?: number;
    temp_id?: number;
    temp_para?: Record<string, string>;
  };
  options?: Options;
  cid?: string;
}

// 推送响应
export interface PushResponse {
  sendno: string;
  msg_id: string;
}

// API错误响应
export interface ApiError {
  error: {
    code: number;
    message: string;
  };
}

@Injectable()
export class JpushService {
  private readonly logger = new Logger(JpushService.name);
  private readonly baseUrl = 'https://api.jpush.cn';
  private readonly config: JpushConfig;

  constructor(config: JpushConfig) {
    this.config = {
      apnsProduction: false,
      timeToLive: 86400,
      ...config,
    };
  }

  /**
   * 生成认证头
   */
  private getAuthHeader(): string {
    const auth = `${this.config.appKey}:${this.config.masterSecret}`;
    return `Basic ${Buffer.from(auth).toString('base64')}`;
  }

  /**
   * 发送HTTP请求
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(),
        },
        data,
      });

      // 记录频率限制信息
      const rateLimitInfo = {
        limit: response.headers['x-rate-limit-limit'],
        remaining: response.headers['x-rate-limit-remaining'],
        reset: response.headers['x-rate-limit-reset'],
      };

      this.logger.debug(`Rate limit info: ${JSON.stringify(rateLimitInfo)}`);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ApiError;
        this.logger.error(`JPush API Error: ${JSON.stringify(errorData)}`);
        throw new Error(
          `JPush API Error [${errorData.error.code}]: ${errorData.error.message}`,
        );
      }
      this.logger.error(`Request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建推送
   */
  async push(payload: PushPayload): Promise<PushResponse> {
    // 设置默认选项
    if (!payload.options) {
      payload.options = {};
    }

    if (payload.options.apns_production === undefined) {
      payload.options.apns_production = this.config.apnsProduction;
    }

    if (payload.options.time_to_live === undefined) {
      payload.options.time_to_live = this.config.timeToLive;
    }

    this.logger.log(`Sending push notification: ${JSON.stringify(payload)}`);

    return this.request<PushResponse>('POST', '/v3/push', payload);
  }

  /**
   * 向所有用户推送通知
   */
  async pushToAll(
    alert: string,
    platform: Platform = 'all',
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform,
      audience: { all: true },
      notification: {
        alert,
        android: extras ? { extras } : undefined,
        ios: extras ? { extras } : undefined,
      },
    };

    return this.push(payload);
  }

  /**
   * 向指定别名推送通知
   */
  async pushToAlias(
    aliases: string[],
    alert: string,
    platform: Platform = 'all',
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform,
      audience: { alias: aliases },
      notification: {
        alert,
        android: extras ? { extras } : undefined,
        ios: extras ? { extras } : undefined,
      },
    };

    return this.push(payload);
  }

  /**
   * 向指定标签推送通知
   */
  async pushToTags(
    tags: string[],
    alert: string,
    platform: Platform = 'all',
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform,
      audience: { tag: tags },
      notification: {
        alert,
        android: extras ? { extras } : undefined,
        ios: extras ? { extras } : undefined,
      },
    };

    return this.push(payload);
  }

  /**
   * 向指定注册ID推送通知
   */
  async pushToRegistrationIds(
    registrationIds: string[],
    alert: string,
    platform: Platform = 'all',
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform,
      audience: { registration_id: registrationIds },
      notification: {
        alert,
        android: extras ? { extras } : undefined,
        ios: extras ? { extras } : undefined,
      },
    };

    return this.push(payload);
  }

  /**
   * 发送自定义消息
   */
  async sendMessage(
    audience: Audience,
    msgContent: string,
    title?: string,
    platform: Platform = 'all',
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform,
      audience,
      message: {
        msg_content: msgContent,
        title,
        extras,
      },
    };

    return this.push(payload);
  }

  /**
   * 推送富媒体通知（Android）
   */
  async pushRichNotificationAndroid(
    audience: Audience,
    alert: string,
    title: string,
    bigText?: string,
    bigPicPath?: string,
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform: 'android',
      audience,
      notification: {
        android: {
          alert,
          title,
          big_text: bigText,
          big_pic_path: bigPicPath,
          style: bigText ? 1 : bigPicPath ? 2 : 0, // 1: big_text, 2: big_pic
          extras,
        },
      },
    };

    return this.push(payload);
  }

  /**
   * 推送iOS通知（带角标和声音）
   */
  async pushNotificationIOS(
    audience: Audience,
    alert: string | { title?: string; body?: string; subtitle?: string },
    badge?: number,
    sound?: string,
    extras?: Record<string, any>,
  ): Promise<PushResponse> {
    const payload: PushPayload = {
      platform: 'ios',
      audience,
      notification: {
        ios: {
          alert,
          badge,
          sound,
          extras,
        },
      },
    };

    return this.push(payload);
  }

  /**
   * 批量单推（需要分批处理，避免超过API限制）
   */
  async batchPushToAliases(
    aliases: string[],
    alert: string,
    platform: Platform = 'all',
    batchSize: number = 1000,
    extras?: Record<string, any>,
  ): Promise<PushResponse[]> {
    const results: PushResponse[] = [];

    for (let i = 0; i < aliases.length; i += batchSize) {
      const batch = aliases.slice(i, i + batchSize);
      const result = await this.pushToAlias(batch, alert, platform, extras);
      results.push(result);

      // 避免触发频率限制，批次间稍微延迟
      if (i + batchSize < aliases.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * 验证推送配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      // 发送一个测试推送到不存在的别名，用于验证配置是否正确
      await this.pushToAlias(['__test_invalid_alias__'], 'test', 'all');
      return true;
    } catch (error) {
      // 如果错误不是因为无效别名，说明配置有问题
      if (error.message.includes('2002') || error.message.includes('2003')) {
        // 2002: 频率限制, 2003: 黑名单 - 这些表示配置是对的
        return true;
      }
      this.logger.error(`Config validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取推送统计信息
   */
  async getReportReceived(msgIds: string[]): Promise<any> {
    const msgIdParam = msgIds.join(',');
    return this.request('GET', `/v3/received?msg_ids=${msgIdParam}`);
  }

  /**
   * 获取消息状态
   */
  async getMessageStatus(
    msgId: string,
    registrationIds?: string[],
  ): Promise<any> {
    let url = `/v3/status/message/${msgId}`;
    if (registrationIds && registrationIds.length > 0) {
      url += `?registration_ids=${registrationIds.join(',')}`;
    }
    return this.request('GET', url);
  }
}
