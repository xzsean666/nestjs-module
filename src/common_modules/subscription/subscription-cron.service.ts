import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * 每日凌晨执行的订阅检查任务
   * 建议在 cron 表达式: '0 0 * * *' (每天 00:00)
   */
  async dailySubscriptionCheck(): Promise<void> {
    this.logger.log('开始执行每日订阅检查任务...');

    try {
      // 1. 处理过期订阅
      this.logger.log('1. 检查并处理过期订阅...');
      const expiredResult =
        await this.subscriptionService.processExpiredSubscriptions();
      this.logger.log(
        `   处理了 ${expiredResult.expired} 个过期订阅，通知了 ${expiredResult.notified} 个用户`,
      );

      if (expiredResult.errors.length > 0) {
        this.logger.warn(
          `   过期订阅处理出现错误: ${expiredResult.errors.join(', ')}`,
        );
      }

      // 2. 发送3天到期提醒（紧急提醒）
      this.logger.log('2. 发送3天到期提醒...');
      const reminder3Days =
        await this.subscriptionService.sendBatchSubscriptionReminders(3);
      this.logger.log(
        `   发送了 ${reminder3Days.sent} 条紧急提醒，${reminder3Days.failed} 条失败`,
      );

      if (reminder3Days.errors.length > 0) {
        this.logger.warn(
          `   3天提醒发送出现错误: ${reminder3Days.errors.join(', ')}`,
        );
      }

      // 3. 发送7天到期提醒（普通提醒）
      this.logger.log('3. 发送7天到期提醒...');
      const reminder7Days =
        await this.subscriptionService.sendBatchSubscriptionReminders(7);
      this.logger.log(
        `   发送了 ${reminder7Days.sent} 条普通提醒，${reminder7Days.failed} 条失败`,
      );

      if (reminder7Days.errors.length > 0) {
        this.logger.warn(
          `   7天提醒发送出现错误: ${reminder7Days.errors.join(', ')}`,
        );
      }

      // 4. 生成并记录统计信息
      this.logger.log('4. 生成每日统计报告...');
      const stats = await this.subscriptionService.getSubscriptionStats();
      this.logger.log(
        `   活跃订阅: ${stats.active}, 即将到期: ${stats.upcomingExpiry}, 本月收入: $${stats.revenue.thisMonth}`,
      );

      this.logger.log('每日订阅检查任务执行完成');
    } catch (error) {
      this.logger.error('每日订阅检查任务执行失败:', error);
      throw error;
    }
  }

  /**
   * 每周一执行的订阅统计报告
   * 建议在 cron 表达式: '0 9 * * 1' (每周一 09:00)
   */
  async weeklySubscriptionReport(): Promise<void> {
    this.logger.log('开始生成每周订阅统计报告...');

    try {
      const stats = await this.subscriptionService.getSubscriptionStats();

      // 获取即将到期的用户（未来14天内）
      const upcomingExpiry14Days =
        await this.subscriptionService.getUpcomingExpiryUsers(14);

      // 记录详细统计信息
      this.logger.log('=== 每周订阅统计报告 ===');
      this.logger.log(`总订阅数: ${stats.total}`);
      this.logger.log(`活跃订阅: ${stats.active}`);
      this.logger.log(`待支付订阅: ${stats.pending}`);
      this.logger.log(`已过期订阅: ${stats.expired}`);
      this.logger.log(`已取消订阅: ${stats.cancelled}`);
      this.logger.log(`即将到期（7天内）: ${stats.upcomingExpiry}`);
      this.logger.log(`即将到期（14天内）: ${upcomingExpiry14Days.length}`);
      this.logger.log(`总收入: $${stats.revenue.total}`);
      this.logger.log(`本月收入: $${stats.revenue.thisMonth}`);
      this.logger.log(`上月收入: $${stats.revenue.lastMonth}`);

      // 如果有过多即将到期的订阅，发出警告
      if (stats.upcomingExpiry > stats.active * 0.2) {
        this.logger.warn(
          `警告: 即将到期的订阅比例过高 (${((stats.upcomingExpiry / stats.active) * 100).toFixed(1)}%)`,
        );
      }

      this.logger.log('每周订阅统计报告生成完成');
    } catch (error) {
      this.logger.error('每周订阅统计报告生成失败:', error);
      throw error;
    }
  }

  /**
   * 每月初执行的月度订阅清理
   * 建议在 cron 表达式: '0 2 1 * *' (每月1日 02:00)
   */
  async monthlySubscriptionCleanup(): Promise<void> {
    this.logger.log('开始执行月度订阅清理任务...');

    try {
      // 生成上月统计报告
      const stats = await this.subscriptionService.getSubscriptionStats();

      this.logger.log('=== 月度订阅报告 ===');
      this.logger.log(`上月收入: $${stats.revenue.lastMonth}`);
      this.logger.log(`本月至今收入: $${stats.revenue.thisMonth}`);
      this.logger.log(`总收入: $${stats.revenue.total}`);

      // 计算收入变化
      const revenueChange = stats.revenue.thisMonth - stats.revenue.lastMonth;
      const revenueChangePercent =
        stats.revenue.lastMonth > 0
          ? ((revenueChange / stats.revenue.lastMonth) * 100).toFixed(1)
          : 'N/A';

      this.logger.log(
        `收入变化: ${revenueChange >= 0 ? '+' : ''}$${revenueChange.toFixed(2)} (${revenueChangePercent}%)`,
      );

      this.logger.log('月度订阅清理任务执行完成');
    } catch (error) {
      this.logger.error('月度订阅清理任务执行失败:', error);
      throw error;
    }
  }

  /**
   * 手动执行紧急到期提醒
   * 可以用于特殊情况下的手动提醒
   */
  async emergencyExpiryReminder(): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    this.logger.log('执行紧急到期提醒...');

    try {
      // 发送1天内到期的紧急提醒
      const result =
        await this.subscriptionService.sendBatchSubscriptionReminders(1);

      this.logger.log(
        `紧急提醒发送完成: 成功 ${result.sent} 条，失败 ${result.failed} 条`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`紧急提醒发送错误: ${result.errors.join(', ')}`);
      }

      return {
        sent: result.sent,
        failed: result.failed,
        errors: result.errors,
      };
    } catch (error) {
      this.logger.error('紧急到期提醒执行失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查：检查订阅系统状态
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    message: string;
    stats: any;
  }> {
    try {
      const stats = await this.subscriptionService.getSubscriptionStats();

      // 检查系统健康状态
      const totalSubscriptions = stats.total;
      const activeRate =
        totalSubscriptions > 0 ? (stats.active / totalSubscriptions) * 100 : 0;
      const upcomingExpiryRate =
        stats.active > 0 ? (stats.upcomingExpiry / stats.active) * 100 : 0;

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = '订阅系统运行正常';

      // 活跃率过低警告
      if (activeRate < 60) {
        status = 'warning';
        message = `活跃订阅率偏低 (${activeRate.toFixed(1)}%)`;
      }

      // 即将到期比例过高警告
      if (upcomingExpiryRate > 30) {
        status = upcomingExpiryRate > 50 ? 'error' : 'warning';
        message = `即将到期订阅比例过高 (${upcomingExpiryRate.toFixed(1)}%)`;
      }

      return {
        status,
        message,
        stats: {
          totalSubscriptions,
          activeRate: parseFloat(activeRate.toFixed(1)),
          upcomingExpiryRate: parseFloat(upcomingExpiryRate.toFixed(1)),
          revenue: stats.revenue,
        },
      };
    } catch (error) {
      this.logger.error('订阅系统健康检查失败:', error);
      return {
        status: 'error',
        message: `健康检查失败: ${error.message}`,
        stats: null,
      };
    }
  }
}
