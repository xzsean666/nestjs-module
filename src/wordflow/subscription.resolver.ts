import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCronService } from './subscription-cron.service';
import {
  UserSubscription,
  CreateSubscriptionRequest,
  CreateSubscriptionWithPaymentRequest,
  SubscriptionPricing,
  SubscriptionStatus,
  SubscriptionPlan,
  User,
} from 'src/types';
import {
  PaymentProvider,
  PaymentMethod,
  PaymentResponse,
} from 'src/payments/types';
import {
  UserSubscriptionDto,
  SubscriptionPricingDto,
  SubscriptionPriceCalculationDto,
  RefundResponseDto,
  PaymentMethodDto,
  BatchReminderResultDto,
  ExpiredSubscriptionResultDto,
  SubscriptionStatsDto,
  EmergencyReminderResultDto,
  SubscriptionHealthCheckDto,
  SubscriptionHealthCheckStatsDto,
  PaymentResponseDto,
  PromoteCodeDto,
  PromoteCodeValidationDto,
  SubscriptionPriceWithPromoteCodeDto,
  CreateSubscriptionWithPaymentDto,
  CreateSubscriptionPaymentDto,
  CreateSubscriptionDto,
} from './dto/subscription.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../common/auth.guard.service';
import { PromoteCodeService } from './promoteCode.service';

@Resolver()
@UseGuards(AuthGuard)
export class SubscriptionResolver {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly subscriptionCronService: SubscriptionCronService,
    private readonly promoteCodeService: PromoteCodeService,
  ) {}

  /**
   * 创建订阅并立即创建支付订单（推荐使用）
   */
  @Mutation(() => PaymentResponseDto)
  async createSubscriptionWithPayment(
    @CurrentUser() user: User,
    @Args('input') input: CreateSubscriptionWithPaymentDto,
  ): Promise<PaymentResponse> {
    return this.subscriptionService.createSubscriptionWithPayment({
      user_id: user.user_id,
      months_count: input.monthsCount,
      paymentProvider: input.paymentProvider,
      paymentMethod: input.paymentMethod,
      promote_code: input.promoteCode,
    });
  }

  /**
   * 创建订阅
   */
  @Mutation(() => UserSubscriptionDto)
  async createSubscription(
    @CurrentUser() user: User,
    @Args('input') input: CreateSubscriptionDto,
  ): Promise<UserSubscription> {
    const request: CreateSubscriptionRequest = {
      user_id: user.user_id,
      months_count: input.monthsCount,
      promote_code: input.promoteCode,
    };
    return this.subscriptionService.createSubscription(request);
  }

  /**
   * 创建订阅支付订单
   */
  @Mutation(() => PaymentResponseDto)
  async createSubscriptionPayment(
    @Args('input') input: CreateSubscriptionPaymentDto,
  ): Promise<PaymentResponse> {
    return this.subscriptionService.createSubscriptionPayment(
      input.subscriptionId,
      input.paymentProvider,
      input.paymentMethod,
    );
  }

  /**
   * 处理支付成功回调（内部使用）
   */
  @Mutation(() => Boolean)
  async handlePaymentSuccess(
    @Args('paymentId') paymentId: string,
  ): Promise<boolean> {
    try {
      await this.subscriptionService.handlePaymentSuccess(paymentId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 申请订阅退款
   */
  @Mutation(() => RefundResponseDto)
  async refundSubscription(
    @Args('subscriptionId') subscriptionId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.subscriptionService.refundSubscription(subscriptionId, reason);
  }

  /**
   * 获取可用的支付方式
   */
  @Query(() => [PaymentMethodDto])
  getAvailablePaymentMethods(): Array<{
    provider: PaymentProvider;
    methods: PaymentMethod[];
  }> {
    return this.subscriptionService.getAvailablePaymentMethods();
  }

  /**
   * 获取用户当前活跃订阅
   */
  @Query(() => UserSubscriptionDto, { nullable: true })
  async getUserActiveSubscription(
    @Args('userId') userId: string,
  ): Promise<UserSubscription | null> {
    console.log('getUserActiveSubscription', userId);
    return this.subscriptionService.getUserActiveSubscription(userId);
  }

  @Query(() => UserSubscriptionDto, { nullable: true })
  async getActiveSubscription(
    @CurrentUser() user: User,
  ): Promise<UserSubscription | null> {
    console.log('getUserActiveSubscription', user.user_id);
    return this.subscriptionService.getUserActiveSubscription(user.user_id);
  }

  /**
   * 激活订阅（支付成功后）
   */
  @Mutation(() => UserSubscriptionDto)
  async activateSubscription(
    @Args('subscriptionId') subscriptionId: string,
    @Args('paymentId', { nullable: true }) paymentId?: string,
  ): Promise<UserSubscription> {
    return this.subscriptionService.activateSubscription(
      subscriptionId,
      paymentId,
    );
  }

  /**
   * 取消订阅
   */
  @Mutation(() => UserSubscriptionDto)
  async cancelSubscription(
    @Args('subscriptionId') subscriptionId: string,
  ): Promise<UserSubscription> {
    return this.subscriptionService.cancelSubscription(subscriptionId);
  }

  /**
   * 续费订阅
   */
  @Mutation(() => UserSubscriptionDto)
  async renewSubscription(
    @Args('userId') userId: string,
    @Args('monthsCount') monthsCount: number,
  ): Promise<UserSubscription> {
    return this.subscriptionService.renewSubscription(userId, monthsCount);
  }

  /**
   * 获取用户订阅历史
   */
  @Query(() => [UserSubscriptionDto])
  async getUserSubscriptionHistory(
    @Args('userId') userId: string,
  ): Promise<UserSubscription[]> {
    return this.subscriptionService.getUserSubscriptionHistory(userId);
  }

  /**
   * 检查用户是否有有效订阅
   */
  @Query(() => Boolean)
  async isUserSubscribed(@Args('userId') userId: string): Promise<boolean> {
    return this.subscriptionService.isUserSubscribed(userId);
  }

  /**
   * 获取订阅价格信息
   */
  @Query(() => SubscriptionPricingDto)
  getSubscriptionPricing(): SubscriptionPricing {
    return this.subscriptionService.getPricing();
  }

  /**
   * 计算订阅价格预览
   */
  @Query(() => SubscriptionPriceCalculationDto)
  calculateSubscriptionPrice(@Args('monthsCount') monthsCount: number): {
    totalPrice: number;
    pricePerMonth: number;
    discount: number;
  } {
    // 自动确定最优plan并计算价格
    const basePriceResult =
      this.subscriptionService.calculatePrice(monthsCount);

    return {
      totalPrice: basePriceResult.total_price,
      pricePerMonth: basePriceResult.price_per_month,
      discount: Math.round(
        (1 -
          basePriceResult.price_per_month /
            this.subscriptionService.getPricing().monthly_price) *
          100,
      ),
    };
  }

  /**
   * 获取即将到期的用户订阅
   */
  @Query(() => [UserSubscriptionDto])
  async getUpcomingExpiryUsers(
    @Args('daysBefore', { nullable: true, defaultValue: 7 }) daysBefore: number,
  ): Promise<UserSubscription[]> {
    return this.subscriptionService.getUpcomingExpiryUsers(daysBefore);
  }

  /**
   * 获取已过期的用户订阅
   */
  @Query(() => [UserSubscriptionDto])
  async getExpiredUsers(): Promise<UserSubscription[]> {
    return this.subscriptionService.getExpiredUsers();
  }

  /**
   * 发送单个用户的订阅提醒
   */
  @Mutation(() => Boolean)
  async sendSubscriptionReminder(
    @Args('userId') userId: string,
    @Args('daysBefore', { nullable: true }) daysBefore?: number,
  ): Promise<boolean> {
    return this.subscriptionService.sendSubscriptionReminder(
      userId,
      daysBefore,
    );
  }

  /**
   * 批量发送到期提醒消息
   */
  @Mutation(() => BatchReminderResultDto)
  async sendBatchSubscriptionReminders(
    @Args('daysBefore', { nullable: true, defaultValue: 7 }) daysBefore: number,
  ): Promise<{
    sent: number;
    failed: number;
    upcomingExpiry: UserSubscription[];
    errors: string[];
  }> {
    return this.subscriptionService.sendBatchSubscriptionReminders(daysBefore);
  }

  /**
   * 处理过期订阅并发送通知
   */
  @Mutation(() => ExpiredSubscriptionResultDto)
  async processExpiredSubscriptions(): Promise<{
    expired: number;
    notified: number;
    errors: string[];
  }> {
    return this.subscriptionService.processExpiredSubscriptions();
  }

  /**
   * 获取订阅统计信息
   */
  @Query(() => SubscriptionStatsDto)
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
    return this.subscriptionService.getSubscriptionStats();
  }

  /**
   * 手动执行每日订阅检查任务
   */
  @Mutation(() => Boolean)
  async runDailySubscriptionCheck(): Promise<boolean> {
    try {
      await this.subscriptionCronService.dailySubscriptionCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 手动执行紧急到期提醒
   */
  @Mutation(() => EmergencyReminderResultDto)
  async runEmergencyExpiryReminder(): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    return this.subscriptionCronService.emergencyExpiryReminder();
  }

  /**
   * 获取订阅系统健康状态
   */
  @Query(() => SubscriptionHealthCheckDto)
  async getSubscriptionHealthCheck(): Promise<{
    status: string;
    message: string;
    stats: {
      totalSubscriptions: number;
      activeRate: number;
      upcomingExpiryRate: number;
      revenue: {
        total: number;
        thisMonth: number;
        lastMonth: number;
      };
    } | null;
  }> {
    return this.subscriptionCronService.healthCheck();
  }

  /**
   * 验证优惠码
   */
  @Query(() => PromoteCodeValidationDto)
  async validatePromoteCode(
    @Args('promoteCode') promoteCode: string,
    @Args('monthsCount') monthsCount: number,
  ): Promise<PromoteCodeValidationDto> {
    // 先计算基础价格（自动确定最优plan）
    const { total_price } =
      this.subscriptionService.calculatePrice(monthsCount);

    const result = await this.promoteCodeService.validateAndApplyPromoteCode(
      promoteCode,
      total_price,
      monthsCount,
    );

    return {
      isValid: result.isValid,
      message: result.message,
      application: result.application,
      promoteCode: result.promoteCode,
    };
  }

  /**
   * 计算带优惠码的订阅价格预览
   */
  @Query(() => SubscriptionPriceWithPromoteCodeDto)
  async calculateSubscriptionPriceWithPromoteCode(
    @Args('monthsCount') monthsCount: number,
    @Args('promoteCode', { nullable: true }) promoteCode?: string,
  ): Promise<SubscriptionPriceWithPromoteCodeDto> {
    // 计算基础价格（自动确定最优plan）
    const basePriceResult =
      this.subscriptionService.calculatePrice(monthsCount);

    let promoteCodeDiscount = 0;
    let freeMonths = 0;
    let finalPrice = basePriceResult.total_price;

    // 如果提供了优惠码，验证并应用
    if (promoteCode) {
      const promoteResult =
        await this.promoteCodeService.validateAndApplyPromoteCode(
          promoteCode,
          basePriceResult.total_price,
          monthsCount,
        );

      if (promoteResult.isValid && promoteResult.application) {
        finalPrice = promoteResult.application.finalPrice;
        promoteCodeDiscount = promoteResult.application.discountAmount;
        freeMonths = promoteResult.application.freeMonths || 0;
      }
    }

    return {
      totalPrice: basePriceResult.total_price,
      pricePerMonth: basePriceResult.price_per_month,
      discount: Math.round(
        (1 -
          basePriceResult.price_per_month /
            this.subscriptionService.getPricing().monthly_price) *
          100,
      ),
      promoteCodeDiscount:
        promoteCodeDiscount > 0 ? promoteCodeDiscount : undefined,
      freeMonths: freeMonths > 0 ? freeMonths : undefined,
      finalPrice,
    };
  }

  /**
   * 获取有效的优惠码列表（管理员功能）
   */
  @Query(() => [PromoteCodeDto])
  async getActivePromoteCodes(): Promise<PromoteCodeDto[]> {
    return this.promoteCodeService.getActivePromoteCodes();
  }
}
