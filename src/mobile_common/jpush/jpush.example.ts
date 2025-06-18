/**
 * 极光推送服务使用示例
 * 这个文件展示了如何在NestJS应用中使用JpushService
 */

import { Injectable } from '@nestjs/common';
import { JpushService, Platform } from './jpush.service';

@Injectable()
export class PushNotificationExample {
  constructor(private readonly jpushService: JpushService) {}

  /**
   * 示例1: 发送简单的全员通知
   */
  async sendBroadcastNotification() {
    try {
      const result = await this.jpushService.pushToAll(
        '欢迎使用我们的应用！',
        'all',
        { type: 'welcome', timestamp: Date.now() },
      );
      console.log('广播推送成功:', result);
      return result;
    } catch (error) {
      console.error('广播推送失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例2: 向特定用户别名发送通知
   */
  async sendPersonalizedNotification(userAlias: string, message: string) {
    try {
      const result = await this.jpushService.pushToAlias(
        [userAlias],
        message,
        'all',
        {
          type: 'personal',
          user_id: userAlias,
          timestamp: Date.now(),
        },
      );
      console.log(`向用户 ${userAlias} 推送成功:`, result);
      return result;
    } catch (error) {
      console.error(`向用户 ${userAlias} 推送失败:`, error.message);
      throw error;
    }
  }

  /**
   * 示例3: 向特定标签组发送通知
   */
  async sendNotificationToTagGroup(tags: string[], message: string) {
    try {
      const result = await this.jpushService.pushToTags(tags, message, 'all', {
        type: 'tag_notification',
        tags: tags.join(','),
        timestamp: Date.now(),
      });
      console.log(`向标签组 ${tags.join(', ')} 推送成功:`, result);
      return result;
    } catch (error) {
      console.error(`向标签组 ${tags.join(', ')} 推送失败:`, error.message);
      throw error;
    }
  }

  /**
   * 示例4: 发送Android富媒体通知
   */
  async sendRichNotificationAndroid(userAliases: string[]) {
    try {
      const result = await this.jpushService.pushRichNotificationAndroid(
        { alias: userAliases },
        '您有新的订单消息',
        '订单通知',
        '您的订单已经发货，预计3-5个工作日内送达。点击查看详情。',
        undefined, // 大图路径，可选
        {
          type: 'order_notification',
          order_id: '12345',
          action: 'view_order',
        },
      );
      console.log('Android富媒体推送成功:', result);
      return result;
    } catch (error) {
      console.error('Android富媒体推送失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例5: 发送iOS通知（带角标和声音）
   */
  async sendIOSNotificationWithBadge(
    userAliases: string[],
    badgeCount: number,
  ) {
    try {
      const result = await this.jpushService.pushNotificationIOS(
        { alias: userAliases },
        {
          title: '新消息',
          body: '您有新的未读消息',
          subtitle: '点击查看详情',
        },
        badgeCount,
        'default', // 使用默认声音
        {
          type: 'message_notification',
          unread_count: badgeCount,
          timestamp: Date.now(),
        },
      );
      console.log('iOS推送成功:', result);
      return result;
    } catch (error) {
      console.error('iOS推送失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例6: 发送自定义消息（透传消息）
   */
  async sendCustomMessage(userAliases: string[], data: any) {
    try {
      const result = await this.jpushService.sendMessage(
        { alias: userAliases },
        JSON.stringify(data),
        '自定义数据',
        'all',
        {
          type: 'custom_data',
          timestamp: Date.now(),
        },
      );
      console.log('自定义消息发送成功:', result);
      return result;
    } catch (error) {
      console.error('自定义消息发送失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例7: 批量推送（处理大量用户）
   */
  async sendBatchNotifications(userAliases: string[], message: string) {
    try {
      const results = await this.jpushService.batchPushToAliases(
        userAliases,
        message,
        'all',
        1000, // 每批1000个用户
        {
          type: 'batch_notification',
          timestamp: Date.now(),
        },
      );
      console.log(`批量推送完成，共 ${results.length} 批次`);
      return results;
    } catch (error) {
      console.error('批量推送失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例8: 验证推送配置
   */
  async validatePushConfiguration() {
    try {
      const isValid = await this.jpushService.validateConfig();
      console.log('推送配置验证结果:', isValid ? '有效' : '无效');
      return isValid;
    } catch (error) {
      console.error('推送配置验证失败:', error.message);
      return false;
    }
  }

  /**
   * 示例9: 获取推送统计信息
   */
  async getPushStatistics(msgIds: string[]) {
    try {
      const stats = await this.jpushService.getReportReceived(msgIds);
      console.log('推送统计信息:', stats);
      return stats;
    } catch (error) {
      console.error('获取推送统计信息失败:', error.message);
      throw error;
    }
  }

  /**
   * 示例10: 查询消息状态
   */
  async checkMessageStatus(msgId: string, registrationIds?: string[]) {
    try {
      const status = await this.jpushService.getMessageStatus(
        msgId,
        registrationIds,
      );
      console.log('消息状态:', status);
      return status;
    } catch (error) {
      console.error('查询消息状态失败:', error.message);
      throw error;
    }
  }
}
