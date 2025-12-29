import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { config, AlertRuleConfig } from '../config';

@Injectable()
export class AlertMessageService {
  private readonly logger = new Logger(AlertMessageService.name);
  private readonly alertConfig = config.ALERT_CONFIG;
  private readonly rules: AlertRuleConfig[] = this.alertConfig?.rules ?? [];

  async sendAlert(message: string, alertLevel: number): Promise<void> {
    if (!this.alertConfig) {
      this.logger.warn('Alert configuration missing, skip sending.');
      return;
    }

    const level = Number(alertLevel);
    if (!Number.isFinite(level)) {
      this.logger.warn(`Invalid alert level "${alertLevel}", skip sending.`);
      return;
    }

    const rule = this.pickRule(level);
    if (!rule) {
      this.logger.debug(
        `Alert level ${level} did not match any rule, message suppressed.`,
      );
      return;
    }

    if (!this.hasWebhookConfigured()) {
      this.logger.warn('No webhook configured for alerts, message suppressed.');
      return;
    }

    const repeatCount = Math.max(0, Math.floor(rule.repeatCount));
    if (repeatCount === 0) {
      this.logger.debug('Repeat count resolved to 0, nothing to send.');
      return;
    }

    const intervalMs = Math.max(
      0,
      Math.round((rule.repeatIntervalSeconds ?? 60) * 1000),
    );

    const formattedMessage = this.formatMessage(message);

    for (let i = 0; i < repeatCount; i++) {
      await this.dispatch(formattedMessage);
      if (i < repeatCount - 1) {
        await this.delay(intervalMs);
      }
    }
  }
  sendAlertImmediate(message: string, alertLevel: number): void {
    setImmediate(() => {
      this.sendAlert(message, alertLevel).catch((error) => {
        this.logger.error(
          `Failed to send alert message asynchronously: ${this.stringifyError(
            error,
          )}`,
        );
      });
    });
  }

  private pickRule(alertLevel: number): AlertRuleConfig | undefined {
    return this.rules.find(
      (rule) =>
        alertLevel >= rule.minLevel &&
        (rule.maxLevel === undefined || alertLevel < rule.maxLevel),
    );
  }

  private formatMessage(message: string): string {
    if (this.alertConfig?.HOST_NAME) {
      return `[Host: ${this.alertConfig.HOST_NAME}] ${message}`;
    }
    return message;
  }

  private hasWebhookConfigured(): boolean {
    return !!(
      this.alertConfig?.SLACK_WEBHOOK_URL ||
      this.alertConfig?.DING_WEBHOOK_URL ||
      this.alertConfig?.FEISHU_WEBHOOK_URL
    );
  }

  private async dispatch(message: string): Promise<void> {
    const results = await Promise.allSettled([
      this.sendToSlack(message),
      this.sendToDingTalk(message),
      this.sendToFeishu(message),
    ]);

    const sent = results
      .map((result) => (result.status === 'fulfilled' ? result.value : false))
      .some(Boolean);

    if (!sent) {
      this.logger.warn('Alert message not sent to any target.');
    }
  }

  private async sendToSlack(message: string): Promise<boolean> {
    if (!this.alertConfig?.SLACK_WEBHOOK_URL) {
      return false;
    }

    try {
      await axios.post(this.alertConfig.SLACK_WEBHOOK_URL, { text: message });
      return true;
    } catch (error) {
      this.logger.error(`Slack send failed: ${this.stringifyError(error)}`);
      return false;
    }
  }

  private async sendToDingTalk(message: string): Promise<boolean> {
    const url = this.buildDingTalkUrl();
    if (!url) {
      return false;
    }

    try {
      await axios.post(url, {
        msgtype: 'text',
        text: { content: message },
      });
      return true;
    } catch (error) {
      this.logger.error(`DingTalk send failed: ${this.stringifyError(error)}`);
      return false;
    }
  }

  private buildDingTalkUrl(): string | null {
    const baseUrl = this.alertConfig?.DING_WEBHOOK_URL;
    if (!baseUrl) {
      return null;
    }

    if (!this.alertConfig.DING_WEBHOOK_SECRET) {
      return baseUrl;
    }

    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${this.alertConfig.DING_WEBHOOK_SECRET}`;
    const sign = crypto
      .createHmac('sha256', this.alertConfig.DING_WEBHOOK_SECRET)
      .update(stringToSign)
      .digest('base64');

    const encodedSign = encodeURIComponent(sign);
    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}timestamp=${timestamp}&sign=${encodedSign}`;
  }

  private async sendToFeishu(message: string): Promise<boolean> {
    const url = this.alertConfig?.FEISHU_WEBHOOK_URL;
    if (!url) {
      return false;
    }

    const body: Record<string, any> = {
      msg_type: 'text',
      content: { text: message },
    };

    if (this.alertConfig.FEISHU_WEBHOOK_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const stringToSign = `${timestamp}\n${this.alertConfig.FEISHU_WEBHOOK_SECRET}`;
      const sign = crypto
        .createHmac('sha256', stringToSign)
        .update('')
        .digest('base64');
      body.timestamp = timestamp;
      body.sign = sign;
    }

    try {
      await axios.post(url, body);
      return true;
    } catch (error) {
      this.logger.error(`Feishu send failed: ${this.stringifyError(error)}`);
      return false;
    }
  }

  private stringifyError(error: any): string {
    if (error?.response?.data) {
      return JSON.stringify(error.response.data);
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
