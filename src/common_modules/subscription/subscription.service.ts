import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { DBService, PGKVDatabase, db_tables } from '../../common/db.service';
import {
  UserSubscription,
  SubscriptionStatus,
  CreateSubscriptionRequest,
  SubscriptionPricing,
  SubscriptionStats,
  SubscriptionReminderResult,
  ExpiredSubscriptionResult,
} from './interfaces/subscription.interface';
import { SubscriptionPlan } from '../promote-code/interfaces/promote-code.interface';
import { v4 as uuidv4 } from 'uuid';

// 配置接口
export interface SubscriptionConfig {
  pricing: SubscriptionPricing;
}

// 可选依赖的接口定义
export interface IPromoteCodeService {
  validateAndApplyPromoteCode(
    code: string,
    price: number,
    months: number,
    plan?: SubscriptionPlan,
  ): Promise<any>;
  usePromoteCode(code: string): Promise<void>;
}

export interface IMessageService {
  createMessage(
    userId: string,
    category: string,
    title: string,
    content: string,
    expiresAt?: number,
  ): Promise<any>;
}

export interface IPaymentService {
  createPayment(request: any): Promise<any>;
  getPaymentRecord(paymentId: string): Promise<any>;
}

@Injectable()
export class SubscriptionService {
  private all_subscriptions: PGKVDatabase;
  private user_subscription: PGKVDatabase;

  // 默认价格配置
  private readonly defaultPricing: SubscriptionPricing = {
    monthly_price: 29.9,
    quarterly_discount: 0.1,
    yearly_discount: 0.2,
  };

  constructor(
    private readonly dbService: DBService,
    @Optional()
    @Inject('SubscriptionConfig')
    private config?: SubscriptionConfig,
    @Optional()
    @Inject('PromoteCodeService')
    private promoteCodeService?: IPromoteCodeService,
    @Optional()
    @Inject('MessageService')
    private messageService?: IMessageService,
    @Optional()
    @Inject('PaymentService')
    private paymentService?: IPaymentService,
  ) {
    this.all_subscriptions = this.dbService.getDBInstance(
      db_tables.all_subscriptions,
    );
    this.user_subscription = this.dbService.getDBInstance(
      db_tables.user_subscription,
    );
  }

  /**
   * 创建用户订阅
   */
  async createSubscription(
    request: CreateSubscriptionRequest,
  ): Promise<UserSubscription> {
    const { user_id, months_count, plan: inputPlan, promote_code } = request;

    if (months_count <= 0) {
      throw new BadRequestException('订阅月数必须大于0');
    }

    const plan = inputPlan || this.determinePlan(months_count);

    // 检查用户是否已有活跃订阅
    const existingSubscription = await this.getUserActiveSubscription(user_id);
    if (existingSubscription) {
      throw new BadRequestException('用户已有活跃订阅');
    }

    // 计算基础价格
    const {
      total_price: originalPrice,
      price_per_month: originalPricePerMonth,
    } = this.calculatePrice(months_count, plan);

    let finalPrice = originalPrice;
    let finalPricePerMonth = originalPricePerMonth;
    let promoteDiscount = 0;
    let freeMonths = 0;
    let appliedPromoteCode: string | undefined;

    // 如果提供了优惠码且优惠码服务可用
    if (promote_code && this.promoteCodeService) {
      const promoteResult =
        await this.promoteCodeService.validateAndApplyPromoteCode(
          promote_code,
          originalPrice,
          months_count,
          plan,
        );

      if (!promoteResult.isValid) {
        throw new BadRequestException(promoteResult.message);
      }

      if (promoteResult.application) {
        finalPrice = promoteResult.application.finalPrice;
        promoteDiscount = promoteResult.application.discountAmount;
        freeMonths = promoteResult.application.freeMonths || 0;
        appliedPromoteCode = promote_code.toUpperCase();

        if (promoteDiscount > 0) {
          finalPricePerMonth = finalPrice / months_count;
        }
      }
    }

    // 计算实际结束日期
    const totalMonths = months_count + freeMonths;

    // 创建订阅记录
    const subscription: UserSubscription = {
      id: uuidv4(),
      user_id,
      plan,
      status: SubscriptionStatus.PENDING,
      start_date: new Date(),
      end_date: this.calculateEndDate(totalMonths),
      months_count,
      price_per_month: finalPricePerMonth,
      total_price: finalPrice,
      promote_code: appliedPromoteCode,
      promote_discount: promoteDiscount > 0 ? promoteDiscount : undefined,
      free_months: freeMonths > 0 ? freeMonths : undefined,
      original_price: promoteDiscount > 0 ? originalPrice : undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.all_subscriptions.put(subscription.id, subscription);
    await this.user_subscription.saveArray(subscription.user_id, [
      subscription.id,
    ]);

    return this.normalizeSubscriptionDates(subscription);
  }

  /**
   * 处理支付成功回调
   */
  async handlePaymentSuccess(paymentId: string): Promise<void> {
    if (!this.paymentService) {
      throw new Error('Payment service is not available');
    }

    const paymentRecord = await this.paymentService.getPaymentRecord(paymentId);
    if (!paymentRecord || !paymentRecord.metadata?.subscriptionId) {
      throw new Error('无法找到对应的订阅信息');
    }

    const subscriptionId = paymentRecord.metadata.subscriptionId;
    const subscription = await this.all_subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    // 如果有优惠码，标记为已使用
    if (subscription.promote_code && this.promoteCodeService) {
      await this.promoteCodeService.usePromoteCode(subscription.promote_code);
    }

    // 激活订阅
    await this.activateSubscription(subscriptionId, paymentId);
  }

  /**
   * 获取用户活跃订阅
   */
  async getUserActiveSubscription(
    user_id: string,
  ): Promise<UserSubscription | null> {
    const subscriptionIds = await this.user_subscription.getAllArray(user_id);
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return null;
    }

    const subscriptions = await Promise.all(
      subscriptionIds.map((id) => this.all_subscriptions.get(id)),
    );

    for (const subscription of subscriptions) {
      if (!subscription) continue;

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        if (!subscription.start_date) {
          console.error(
            `Subscription ${subscription.id} for user ${user_id} is active but has no start_date.`,
          );
          continue;
        }

        // 检查是否过期
        if (new Date() > new Date(subscription.end_date)) {
          await this.expireSubscription(subscription.id);
          continue;
        }

        return this.normalizeSubscriptionDates(subscription);
      }
    }

    return null;
  }

  /**
   * 激活订阅
   */
  async activateSubscription(
    subscriptionId: string,
    paymentId?: string,
  ): Promise<UserSubscription> {
    const subscription = await this.all_subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    const updatedSubscription: UserSubscription = {
      ...subscription,
      status: SubscriptionStatus.ACTIVE,
      payment_id: paymentId,
      updated_at: new Date(),
    };

    await this.all_subscriptions.put(subscriptionId, updatedSubscription);
    return this.normalizeSubscriptionDates(updatedSubscription);
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(subscriptionId: string): Promise<UserSubscription> {
    const subscription = await this.all_subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    const updatedSubscription: UserSubscription = {
      ...subscription,
      status: SubscriptionStatus.CANCELLED,
      updated_at: new Date(),
    };

    await this.all_subscriptions.put(subscriptionId, updatedSubscription);
    return this.normalizeSubscriptionDates(updatedSubscription);
  }

  /**
   * 过期订阅
   */
  async expireSubscription(subscriptionId: string): Promise<UserSubscription> {
    const subscription = await this.all_subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    const updatedSubscription: UserSubscription = {
      ...subscription,
      status: SubscriptionStatus.EXPIRED,
      updated_at: new Date(),
    };

    await this.all_subscriptions.put(subscriptionId, updatedSubscription);
    return this.normalizeSubscriptionDates(updatedSubscription);
  }

  /**
   * 续费订阅
   */
  async renewSubscription(
    user_id: string,
    months_count: number,
  ): Promise<UserSubscription> {
    const activeSubscription = await this.getUserActiveSubscription(user_id);

    if (activeSubscription) {
      const newEndDate = new Date(activeSubscription.end_date);
      newEndDate.setMonth(newEndDate.getMonth() + months_count);

      const plan = this.determinePlan(months_count);
      const { total_price } = this.calculatePrice(months_count, plan);

      const updatedSubscription: UserSubscription = {
        ...activeSubscription,
        end_date: newEndDate,
        months_count: activeSubscription.months_count + months_count,
        total_price: activeSubscription.total_price + total_price,
        updated_at: new Date(),
      };

      await this.all_subscriptions.put(
        activeSubscription.id,
        updatedSubscription,
      );
      return this.normalizeSubscriptionDates(updatedSubscription);
    } else {
      return this.createSubscription({ user_id, months_count });
    }
  }

  /**
   * 获取用户订阅历史
   */
  async getUserSubscriptionHistory(
    user_id: string,
  ): Promise<UserSubscription[]> {
    const subscriptionIds = await this.user_subscription.getAllArray(user_id);
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return [];
    }

    const subscriptions = await Promise.all(
      subscriptionIds.map((id) => this.all_subscriptions.get(id)),
    );

    return subscriptions
      .filter((subscription) => subscription !== null)
      .map((subscription) => this.normalizeSubscriptionDates(subscription))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }

  /**
   * 检查用户是否有有效订阅
   */
  async isUserSubscribed(user_id: string): Promise<boolean> {
    const activeSubscription = await this.getUserActiveSubscription(user_id);
    return !!activeSubscription;
  }

  /**
   * 获取订阅价格信息
   */
  getPricing(): SubscriptionPricing {
    return this.config?.pricing || this.defaultPricing;
  }

  /**
   * 计算价格
   */
  public calculatePrice(
    months_count: number,
    plan?: SubscriptionPlan,
  ): { total_price: number; price_per_month: number } {
    const pricing = this.getPricing();
    const finalPlan = plan || this.determinePlan(months_count);

    let price_per_month = pricing.monthly_price;
    let discount = 0;

    switch (finalPlan) {
      case SubscriptionPlan.QUARTERLY:
        discount = pricing.quarterly_discount;
        break;
      case SubscriptionPlan.YEARLY:
        discount = pricing.yearly_discount;
        break;
      case SubscriptionPlan.CUSTOM:
        if (months_count >= 12) {
          discount = pricing.yearly_discount;
        } else if (months_count >= 3) {
          discount = pricing.quarterly_discount;
        }
        break;
      case SubscriptionPlan.MONTHLY:
        discount = 0;
        break;
    }

    price_per_month = price_per_month * (1 - discount);
    const total_price = price_per_month * months_count;

    return {
      total_price: Math.round(total_price * 100) / 100,
      price_per_month: Math.round(price_per_month * 100) / 100,
    };
  }

  /**
   * 发送订阅到期提醒消息
   */
  async sendSubscriptionReminder(
    user_id: string,
    daysBefore?: number,
  ): Promise<boolean> {
    if (!this.messageService) {
      console.warn('Message service is not available');
      return false;
    }

    const subscription = await this.getUserActiveSubscription(user_id);
    if (!subscription) {
      return false;
    }

    const endDateStr = new Date(subscription.end_date).toLocaleDateString(
      'zh-CN',
    );
    const daysUntilExpiry = Math.ceil(
      (new Date(subscription.end_date).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    let title: string;
    let content: string;

    if (daysUntilExpiry <= 0) {
      title = '订阅已过期';
      content = `您的订阅已于 ${endDateStr} 过期。为了继续使用我们的服务，请及时续费。`;
    } else if (daysUntilExpiry <= 3) {
      title = '订阅即将到期';
      content = `您的订阅将在 ${daysUntilExpiry} 天后（${endDateStr}）到期。为避免服务中断，请及时续费。`;
    } else {
      title = '订阅到期提醒';
      content = `您的订阅将在 ${daysUntilExpiry} 天后（${endDateStr}）到期。现在续费可享受优惠价格！`;
    }

    content += `\n\n当前订阅计划：${this.getPlanDisplayName(subscription.plan)}`;
    content += `\n订阅时长：${subscription.months_count} 个月`;
    content += `\n点击续费享受更多优惠！`;

    await this.messageService.createMessage(
      user_id,
      'SUBSCRIPTION',
      title,
      content,
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );

    return true;
  }

  /**
   * 批量发送到期提醒消息
   */
  async sendBatchSubscriptionReminders(
    daysBefore: number = 7,
  ): Promise<SubscriptionReminderResult> {
    const upcomingExpiryUsers = await this.getUpcomingExpiryUsers(daysBefore);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const subscription of upcomingExpiryUsers) {
      try {
        const success = await this.sendSubscriptionReminder(
          subscription.user_id,
          daysBefore,
        );
        if (success) {
          sent++;
        } else {
          failed++;
          errors.push(`用户 ${subscription.user_id} 没有活跃订阅`);
        }
      } catch (error) {
        failed++;
        errors.push(`用户 ${subscription.user_id} 发送失败: ${error.message}`);
      }
    }

    return {
      sent,
      failed,
      upcomingExpiry: upcomingExpiryUsers,
      errors,
    };
  }

  /**
   * 处理过期订阅并发送通知
   */
  async processExpiredSubscriptions(): Promise<ExpiredSubscriptionResult> {
    const expiredUsers = await this.getExpiredUsers();
    let notified = 0;
    const errors: string[] = [];

    for (const subscription of expiredUsers) {
      try {
        await this.sendSubscriptionReminder(subscription.user_id);
        notified++;
      } catch (error) {
        errors.push(`用户 ${subscription.user_id} 通知失败: ${error.message}`);
      }
    }

    return {
      expired: expiredUsers.length,
      notified,
      errors,
    };
  }

  /**
   * 获取即将到期的用户订阅
   */
  async getUpcomingExpiryUsers(
    daysBefore: number = 7,
  ): Promise<UserSubscription[]> {
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(now.getDate() + daysBefore);

    const activeSubscriptions = await this.getAllActiveSubscriptions();

    return activeSubscriptions
      .filter((subscription) => {
        const endDate = new Date(subscription.end_date);
        return endDate <= reminderDate && endDate > now;
      })
      .sort(
        (a, b) =>
          new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
      );
  }

  /**
   * 获取已过期的用户订阅
   */
  async getExpiredUsers(): Promise<UserSubscription[]> {
    const now = new Date();
    const activeSubscriptions = await this.getAllActiveSubscriptions();
    const expiredUsers: UserSubscription[] = [];

    for (const subscription of activeSubscriptions) {
      if (new Date(subscription.end_date) <= now) {
        await this.expireSubscription(subscription.id);
        expiredUsers.push({
          ...subscription,
          status: SubscriptionStatus.EXPIRED,
        });
      }
    }

    return expiredUsers;
  }

  /**
   * 获取订阅统计信息
   */
  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const upcomingExpiryDate = new Date();
    upcomingExpiryDate.setDate(now.getDate() + 7);

    const stats: SubscriptionStats = {
      total: 0,
      active: 0,
      pending: 0,
      expired: 0,
      cancelled: 0,
      upcomingExpiry: 0,
      revenue: {
        total: 0,
        thisMonth: 0,
        lastMonth: 0,
      },
    };

    // 获取所有订阅
    const allSubscriptions = await this.all_subscriptions.getAll();

    for (const [key, value] of Object.entries(allSubscriptions)) {
      const subscription = value as UserSubscription;
      stats.total++;

      // 统计状态
      switch (subscription.status) {
        case SubscriptionStatus.ACTIVE:
          stats.active++;
          stats.revenue.total += subscription.total_price;

          // 统计即将到期
          if (
            new Date(subscription.end_date) <= upcomingExpiryDate &&
            new Date(subscription.end_date) > now
          ) {
            stats.upcomingExpiry++;
          }

          // 统计本月收入
          if (new Date(subscription.created_at) >= thisMonthStart) {
            stats.revenue.thisMonth += subscription.total_price;
          }

          // 统计上月收入
          if (
            new Date(subscription.created_at) >= lastMonthStart &&
            new Date(subscription.created_at) <= lastMonthEnd
          ) {
            stats.revenue.lastMonth += subscription.total_price;
          }
          break;
        case SubscriptionStatus.PENDING:
          stats.pending++;
          break;
        case SubscriptionStatus.EXPIRED:
          stats.expired++;
          break;
        case SubscriptionStatus.CANCELLED:
          stats.cancelled++;
          break;
      }
    }

    // 保留两位小数
    stats.revenue.total = Math.round(stats.revenue.total * 100) / 100;
    stats.revenue.thisMonth = Math.round(stats.revenue.thisMonth * 100) / 100;
    stats.revenue.lastMonth = Math.round(stats.revenue.lastMonth * 100) / 100;

    return stats;
  }

  /**
   * 转换日期字符串为Date对象
   */
  private normalizeSubscriptionDates(
    subscription: UserSubscription,
  ): UserSubscription {
    return {
      ...subscription,
      start_date:
        subscription.start_date instanceof Date
          ? subscription.start_date
          : new Date(subscription.start_date),
      end_date:
        subscription.end_date instanceof Date
          ? subscription.end_date
          : new Date(subscription.end_date),
      created_at:
        subscription.created_at instanceof Date
          ? subscription.created_at
          : new Date(subscription.created_at),
      updated_at:
        subscription.updated_at instanceof Date
          ? subscription.updated_at
          : new Date(subscription.updated_at),
    };
  }

  /**
   * 计算结束日期
   */
  private calculateEndDate(months_count: number): Date {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months_count);
    return endDate;
  }

  /**
   * 根据月数确定最优计划类型
   */
  private determinePlan(months_count: number): SubscriptionPlan {
    if (months_count === 1) return SubscriptionPlan.MONTHLY;
    if (months_count === 3) return SubscriptionPlan.QUARTERLY;
    if (months_count === 12) return SubscriptionPlan.YEARLY;

    if (months_count >= 12) {
      return SubscriptionPlan.YEARLY;
    } else if (months_count >= 3) {
      return SubscriptionPlan.QUARTERLY;
    } else {
      return SubscriptionPlan.MONTHLY;
    }
  }

  /**
   * 获取订阅计划的显示名称
   */
  private getPlanDisplayName(plan: SubscriptionPlan): string {
    const planNames = {
      [SubscriptionPlan.MONTHLY]: '月度计划',
      [SubscriptionPlan.QUARTERLY]: '季度计划',
      [SubscriptionPlan.YEARLY]: '年度计划',
      [SubscriptionPlan.CUSTOM]: '自定义计划',
    };
    return planNames[plan] || '未知计划';
  }

  /**
   * 获取所有活跃订阅
   */
  private async getAllActiveSubscriptions(): Promise<UserSubscription[]> {
    const searchResult = await this.all_subscriptions.searchJson({
      contains: {
        status: SubscriptionStatus.ACTIVE,
      },
      limit: 10000,
    });

    if (!searchResult.data || searchResult.data.length === 0) {
      return [];
    }

    return searchResult.data.map((item) => item.value as UserSubscription);
  }
}
