import {
  Injectable,
  forwardRef,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  db_tables,
  PGKVDatabase,
  DBService,
  keys,
} from 'src/common/db.service';
import {
  UserSubscription,
  SubscriptionStatus,
  SubscriptionPlan,
  CreateSubscriptionRequest,
  CreateSubscriptionWithPaymentRequest,
  SubscriptionPricing,
} from 'src/types';
import {
  PaymentProvider,
  PaymentMethod,
  CreatePaymentRequest,
  PaymentStatus,
  PaymentResponse,
  PaymentConfig,
} from 'src/payments/types';
import { v4 as uuidv4 } from 'uuid';
import { SystemMessageService } from '../user/systemMessage.service';
import { MessageCategory } from '../user/dto/systemMessage.dto';
import { UnitPayService } from '../payments/unitPay.service';
import { config } from 'src/config';
import { PromoteCodeService } from './promoteCode.service';

@Injectable()
export class SubscriptionService {
  private all_subscriptions: PGKVDatabase;
  private user_subscription: PGKVDatabase;

  // 订阅价格配置
  private readonly pricing: SubscriptionPricing = config.pricing;

  constructor(
    private readonly dbService: DBService,
    private readonly systemMessageService: SystemMessageService,
    private readonly unitPayService: UnitPayService,
    private readonly promoteCodeService: PromoteCodeService,
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

    // 验证参数
    if (months_count <= 0) {
      throw new BadRequestException('订阅月数必须大于0');
    }

    // 自动确定最优plan
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

    // 如果提供了优惠码，验证并应用
    if (promote_code) {
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

        // 重新计算月单价（仅在有折扣的情况下）
        if (promoteDiscount > 0) {
          finalPricePerMonth = finalPrice / months_count;
        }
      }
    }

    // 计算实际结束日期（包含赠送月数）
    const totalMonths = months_count + freeMonths;

    // 创建订阅记录
    const subscription: UserSubscription = {
      id: uuidv4(),
      user_id,
      plan,
      status: SubscriptionStatus.PENDING, // 等待支付
      start_date: new Date(),
      end_date: this.calculateEndDate(totalMonths), // 使用包含赠送月数的总月数
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

    // 将订阅ID保存到用户订阅索引中
    await this.user_subscription.saveArray(subscription.user_id, [
      subscription.id,
    ]);

    return this.normalizeSubscriptionDates(subscription);
  }

  /**
   * 创建用户订阅并立即创建支付订单（推荐使用）
   */
  async createSubscriptionWithPayment(
    request: CreateSubscriptionWithPaymentRequest,
  ): Promise<PaymentResponse> {
    const {
      user_id,
      months_count,
      plan: inputPlan,
      paymentProvider,
      paymentMethod,
      promote_code,
    } = request;

    // 先创建订阅（会自动确定最优plan）
    const subscription = await this.createSubscription({
      user_id,
      months_count,
      plan: inputPlan,
      promote_code,
    });

    // 立即创建支付订单
    const paymentResponse = await this.createSubscriptionPayment(
      subscription.id,
      paymentProvider as PaymentProvider,
      paymentMethod as PaymentMethod,
    );

    return paymentResponse;
  }

  /**
   * 创建订阅支付订单
   */
  async createSubscriptionPayment(
    subscriptionId: string,
    paymentProvider: PaymentProvider,
    paymentMethod: PaymentMethod,
  ): Promise<PaymentResponse> {
    const subscription = await this.all_subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BadRequestException('订阅状态不允许支付');
    }

    // 创建支付订单
    const paymentRequest: CreatePaymentRequest = {
      orderId: `SUB_${subscriptionId}`,
      amount: subscription.total_price,
      currency: 'CNY',
      subject: `订阅服务 - ${this.getPlanDisplayName(subscription.plan)}`,
      body: `${subscription.months_count}个月订阅服务`,
      method: paymentMethod,
      provider: paymentProvider,
      userId: subscription.user_id,
      metadata: {
        subscriptionId,
        months_count: subscription.months_count,
        plan: subscription.plan,
      },
      expireTime: new Date(Date.now() + 30 * 60 * 1000), // 30分钟有效期
    };

    const paymentResponse =
      await this.unitPayService.createPayment(paymentRequest);

    if (paymentResponse.success) {
      // 更新订阅记录，关联支付ID
      const updatedSubscription: UserSubscription = {
        ...subscription,
        payment_id: paymentResponse.paymentId,
        updated_at: new Date(),
      };

      await this.all_subscriptions.put(subscriptionId, updatedSubscription);
    }

    return paymentResponse;
  }

  /**
   * 处理支付成功回调
   */
  async handlePaymentSuccess(paymentId: string): Promise<void> {
    // 通过支付记录查找对应的订阅
    const paymentRecord = await this.unitPayService.getPaymentRecord(paymentId);
    if (!paymentRecord || !paymentRecord.metadata?.subscriptionId) {
      throw new Error('无法找到对应的订阅信息');
    }

    const subscriptionId = paymentRecord.metadata.subscriptionId;
    const subscription = await this.all_subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error('订阅不存在');
    }

    // 如果有优惠码，标记为已使用
    if (subscription.promote_code) {
      await this.promoteCodeService.usePromoteCode(subscription.promote_code);
    }

    // 获取订阅
    await this.user_subscription.saveArray(subscription.user_id, [
      subscription.id,
    ]);

    // 激活订阅
    await this.activateSubscription(subscriptionId, paymentId);
  }

  /**
   * 获取用户活跃订阅（优化版本）
   */
  async getUserActiveSubscription(
    user_id: string,
  ): Promise<UserSubscription | null> {
    // 先从 user_subscription 获取用户的订阅ID列表
    const subscriptionIds = await this.user_subscription.getAllArray(user_id);
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return null;
    }

    // 获取所有订阅详情
    const subscriptions = await Promise.all(
      subscriptionIds.map((id) => this.all_subscriptions.get(id)),
    );

    // 找到活跃且未过期的订阅
    for (const subscription of subscriptions) {
      if (!subscription) continue;

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        // Check for missing start_date before checking expiry
        if (!subscription.start_date) {
          console.error(
            `Subscription ${subscription.id} for user ${user_id} is active but has no start_date.`,
          );
          // Decide how to handle this case: treat as invalid/expired?
          // For now, let's skip this subscription to prevent GraphQL errors.
          continue;
        }

        // 检查是否过期
        if (new Date() > new Date(subscription.end_date)) {
          await this.expireSubscription(subscription.id);
          continue;
        }

        // Convert date strings to Date objects for GraphQL serialization
        return this.normalizeSubscriptionDates(subscription);
      }
    }

    return null;
  }

  /**
   * Convert date strings to Date objects for GraphQL serialization
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
   * 激活订阅（支付成功后调用）
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
   * 申请退款
   */
  async refundSubscription(
    subscriptionId: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    const subscription = await this.all_subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('订阅不存在');
    }

    if (!subscription.payment_id) {
      throw new BadRequestException('订阅没有关联的支付记录');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('只有活跃订阅才能申请退款');
    }

    try {
      // 申请退款
      const refundResponse = await this.unitPayService.refundPayment(
        subscription.payment_id,
        subscription.total_price,
        reason || '用户取消订阅',
      );

      if (refundResponse.success) {
        // 更新订阅状态
        const updatedSubscription: UserSubscription = {
          ...subscription,
          status: SubscriptionStatus.CANCELLED,
          updated_at: new Date(),
        };

        await this.all_subscriptions.put(subscriptionId, updatedSubscription);

        return {
          success: true,
          message: '退款申请成功',
        };
      } else {
        return {
          success: false,
          message: refundResponse.message || '退款申请失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
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
      // 如果有活跃订阅，延长结束时间
      const newEndDate = new Date(activeSubscription.end_date);
      newEndDate.setMonth(newEndDate.getMonth() + months_count);

      const plan = this.determinePlan(months_count);
      const { total_price, price_per_month } = this.calculatePrice(
        months_count,
        plan,
      );

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
      // 如果没有活跃订阅，创建新订阅（createSubscription已经优化过，会自动处理user_subscription索引）
      return this.createSubscription({ user_id, months_count });
    }
  }

  /**
   * 获取用户订阅历史（优化版本）
   */
  async getUserSubscriptionHistory(
    user_id: string,
  ): Promise<UserSubscription[]> {
    // 先从 user_subscription 获取用户的订阅ID列表
    const subscriptionIds = await this.user_subscription.getAllArray(user_id);
    if (!subscriptionIds || subscriptionIds.length === 0) {
      return [];
    }

    // 获取所有订阅详情
    const subscriptions = await Promise.all(
      subscriptionIds.map((id) => this.all_subscriptions.get(id)),
    );

    // 过滤掉空值并按创建时间降序排序，同时规范化日期
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
    return this.pricing;
  }

  /**
   * 获取可用的支付方式
   */
  getAvailablePaymentMethods(): Array<{
    provider: PaymentProvider;
    methods: PaymentMethod[];
  }> {
    return this.unitPayService.getAvailablePaymentMethods();
  }

  /**
   * 计算价格
   */
  public calculatePrice(
    months_count: number,
    plan?: SubscriptionPlan,
  ): { total_price: number; price_per_month: number } {
    // 如果没有提供plan，自动确定最优plan
    const finalPlan = plan || this.determinePlan(months_count);

    let price_per_month = this.pricing.monthly_price;
    let discount = 0;

    // 根据计划应用折扣
    switch (finalPlan) {
      case SubscriptionPlan.QUARTERLY:
        discount = this.pricing.quarterly_discount;
        break;
      case SubscriptionPlan.YEARLY:
        discount = this.pricing.yearly_discount;
        break;
      case SubscriptionPlan.CUSTOM:
        // 自定义计划：超过3个月享受季度折扣，超过12个月享受年度折扣
        if (months_count >= 12) {
          discount = this.pricing.yearly_discount;
        } else if (months_count >= 3) {
          discount = this.pricing.quarterly_discount;
        }
        break;
      case SubscriptionPlan.MONTHLY:
        // 月度计划没有折扣
        discount = 0;
        break;
    }

    price_per_month = price_per_month * (1 - discount);
    const total_price = price_per_month * months_count;

    return {
      total_price: Math.round(total_price * 100) / 100, // 保留两位小数
      price_per_month: Math.round(price_per_month * 100) / 100,
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
   * 根据月数确定最优计划类型（自动选择折扣最大的方案）
   */
  private determinePlan(months_count: number): SubscriptionPlan {
    // 精确匹配标准计划
    if (months_count === 1) return SubscriptionPlan.MONTHLY;
    if (months_count === 3) return SubscriptionPlan.QUARTERLY;
    if (months_count === 12) return SubscriptionPlan.YEARLY;

    // 对于其他月数，选择能享受最大折扣的计划
    if (months_count >= 12) {
      // 12个月及以上，使用年度计划享受最大折扣
      return SubscriptionPlan.YEARLY;
    } else if (months_count >= 3) {
      // 3-11个月，使用季度计划享受中等折扣
      return SubscriptionPlan.QUARTERLY;
    } else {
      // 1-2个月，使用月度计划
      return SubscriptionPlan.MONTHLY;
    }
  }

  /**
   * 获取即将到期的用户订阅（优化版本）
   * @param daysBefore 提前多少天提醒，默认7天
   */
  async getUpcomingExpiryUsers(
    daysBefore: number = 7,
  ): Promise<UserSubscription[]> {
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(now.getDate() + daysBefore);

    // 获取所有活跃订阅，然后在内存中过滤
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
   * 获取已过期的用户订阅（优化版本）
   */
  async getExpiredUsers(): Promise<UserSubscription[]> {
    const now = new Date();

    // 获取所有活跃订阅，然后在内存中过滤过期的
    const activeSubscriptions = await this.getAllActiveSubscriptions();

    const expiredUsers: UserSubscription[] = [];

    // 处理过期订阅
    for (const subscription of activeSubscriptions) {
      if (new Date(subscription.end_date) <= now) {
        // 自动将过期订阅标记为过期状态
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
   * 发送订阅到期提醒消息
   */
  async sendSubscriptionReminder(
    user_id: string,
    daysBefore?: number,
  ): Promise<boolean> {
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

    await this.systemMessageService.createMessage(
      user_id,
      MessageCategory.SUBSCRIPTION,
      title,
      content,
      // 设置消息30天后过期
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );

    return true;
  }

  /**
   * 批量发送到期提醒消息
   */
  async sendBatchSubscriptionReminders(daysBefore: number = 7): Promise<{
    sent: number;
    failed: number;
    upcomingExpiry: UserSubscription[];
    errors: string[];
  }> {
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
  async processExpiredSubscriptions(): Promise<{
    expired: number;
    notified: number;
    errors: string[];
  }> {
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
   * 获取订阅统计信息（优化版本）
   */
  async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    expired: number;
    cancelled: number;
    upcomingExpiry: number;
    revenue: {
      total: number;
      thisMonth: number;
      lastMonth: number;
    };
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const upcomingExpiryDate = new Date();
    upcomingExpiryDate.setDate(now.getDate() + 7);

    const stats = {
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

    // 并行执行多个查询以提高性能
    const [
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      upcomingExpirySubscriptions,
      thisMonthActiveSubscriptions,
      lastMonthActiveSubscriptions,
    ] = await Promise.all([
      // 活跃订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.ACTIVE },
        limit: 10000,
      }),
      // 待处理订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.PENDING },
        limit: 10000,
      }),
      // 过期订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.EXPIRED },
        limit: 10000,
      }),
      // 取消订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.CANCELLED },
        limit: 10000,
      }),
      // 即将到期的活跃订阅（7天内）
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.ACTIVE },
        compare: [
          {
            path: 'end_date',
            operator: '<=',
            value: upcomingExpiryDate.toISOString(),
          },
          {
            path: 'end_date',
            operator: '>',
            value: now.toISOString(),
          },
        ],
        limit: 10000,
      }),
      // 本月活跃订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.ACTIVE },
        compare: [
          {
            path: 'created_at',
            operator: '>=',
            value: thisMonthStart.toISOString(),
          },
        ],
        limit: 10000,
      }),
      // 上月活跃订阅
      this.all_subscriptions.searchJson({
        contains: { status: SubscriptionStatus.ACTIVE },
        compare: [
          {
            path: 'created_at',
            operator: '>=',
            value: lastMonthStart.toISOString(),
          },
          {
            path: 'created_at',
            operator: '<=',
            value: lastMonthEnd.toISOString(),
          },
        ],
        limit: 10000,
      }),
    ]);

    // 统计各种状态的订阅数量
    stats.active = activeSubscriptions.data?.length || 0;
    stats.pending = pendingSubscriptions.data?.length || 0;
    stats.expired = expiredSubscriptions.data?.length || 0;
    stats.cancelled = cancelledSubscriptions.data?.length || 0;
    stats.upcomingExpiry = upcomingExpirySubscriptions.data?.length || 0;
    stats.total =
      stats.active + stats.pending + stats.expired + stats.cancelled;

    // 计算收入（只计算已激活的订阅）
    if (activeSubscriptions.data) {
      for (const item of activeSubscriptions.data) {
        const sub = item.value as UserSubscription;
        stats.revenue.total += sub.total_price;
      }
    }

    if (thisMonthActiveSubscriptions.data) {
      for (const item of thisMonthActiveSubscriptions.data) {
        const sub = item.value as UserSubscription;
        stats.revenue.thisMonth += sub.total_price;
      }
    }

    if (lastMonthActiveSubscriptions.data) {
      for (const item of lastMonthActiveSubscriptions.data) {
        const sub = item.value as UserSubscription;
        stats.revenue.lastMonth += sub.total_price;
      }
    }

    // 保留两位小数
    stats.revenue.total = Math.round(stats.revenue.total * 100) / 100;
    stats.revenue.thisMonth = Math.round(stats.revenue.thisMonth * 100) / 100;
    stats.revenue.lastMonth = Math.round(stats.revenue.lastMonth * 100) / 100;

    return stats;
  }

  /**
   * Mock支付成功 - 仅用于测试环境
   */
  mockPaymentSuccess(orderId: string): boolean {
    return this.unitPayService.mockPaymentSuccess(orderId);
  }

  /**
   * Mock支付失败 - 仅用于测试环境
   */
  mockPaymentFailure(orderId: string, reason?: string): boolean {
    return this.unitPayService.mockPaymentFailure(orderId, reason);
  }

  /**
   * 获取Mock支付记录 - 仅用于测试环境
   */
  getMockPaymentRecords(): Array<any> {
    return this.unitPayService.getMockPaymentRecords();
  }

  /**
   * 获取所有活跃订阅（用于批量检查到期状态）
   */
  private async getAllActiveSubscriptions(): Promise<UserSubscription[]> {
    // 使用 searchJson 查找活跃订阅
    const searchResult = await this.all_subscriptions.searchJson({
      contains: {
        status: SubscriptionStatus.ACTIVE,
      },
      limit: 10000, // 设置合理的限制
    });

    if (!searchResult.data || searchResult.data.length === 0) {
      return [];
    }

    return searchResult.data.map((item) => item.value as UserSubscription);
  }
}
