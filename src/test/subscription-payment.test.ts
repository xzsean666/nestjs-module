/**
 * 订阅和Mock支付功能测试
 *
 * 这个测试文件验证了完整的订阅支付流程：
 * 1. 创建订阅（PENDING状态）
 * 2. 创建Mock支付
 * 3. 模拟支付成功
 * 4. 激活订阅（ACTIVE状态）
 * 5. 验证用户有效订阅
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../wordflow/subscription.service';
import { UnitPayService } from '../payments/unitPay.service';
import { DBService } from '../common/db.service';
import { SystemMessageService } from '../user/systemMessage.service';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  CreateSubscriptionRequest,
} from '../types';
import {
  PaymentProvider,
  PaymentMethod,
  PaymentStatus,
} from '../payments/types';

describe('订阅和Mock支付功能测试', () => {
  let subscriptionService: SubscriptionService;
  let unitPayService: UnitPayService;
  let module: TestingModule;

  const testUserId = 'test_user_001';
  const testPlan = SubscriptionPlan.MONTHLY;
  const testMonthsCount = 1;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        UnitPayService,
        DBService,
        {
          provide: SystemMessageService,
          useValue: {
            createMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    unitPayService = module.get<UnitPayService>(UnitPayService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('完整的订阅支付流程', () => {
    let subscriptionId: string;
    let paymentOrderId: string;

    it('应该成功创建PENDING状态的订阅', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: testUserId,
        months_count: testMonthsCount,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      expect(subscription).toBeDefined();
      expect(subscription.user_id).toBe(testUserId);
      expect(subscription.status).toBe(SubscriptionStatus.PENDING);
      expect(subscription.months_count).toBe(testMonthsCount);
      expect(subscription.plan).toBeDefined();
      expect(subscription.total_price).toBeGreaterThan(0);

      subscriptionId = subscription.id;
    });

    it('用户此时应该没有活跃订阅', async () => {
      const activeSubscription =
        await subscriptionService.getUserActiveSubscription(testUserId);
      expect(activeSubscription).toBeNull();
    });

    it('用户订阅状态应该为false', async () => {
      const isSubscribed =
        await subscriptionService.isUserSubscribed(testUserId);
      expect(isSubscribed).toBe(false);
    });

    it('应该成功创建Mock支付订单', async () => {
      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscriptionId,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_QR,
        );

      expect(paymentResponse.success).toBe(true);
      expect(paymentResponse.paymentId).toBeDefined();
      expect(paymentResponse.orderId).toBeDefined();
      expect(paymentResponse.status).toBe(PaymentStatus.PENDING);
      expect(paymentResponse.payData).toBeDefined();
      expect(paymentResponse.payData.qrCode).toContain('mock-payment.com');

      paymentOrderId = paymentResponse.orderId;
    });

    it('应该能够模拟支付成功', () => {
      const success = subscriptionService.mockPaymentSuccess(paymentOrderId);
      expect(success).toBe(true);
    });

    it('应该能够处理支付成功回调并激活订阅', async () => {
      // 处理支付成功回调
      await subscriptionService.handlePaymentSuccess(paymentOrderId);

      // 验证订阅已激活
      const activeSubscription =
        await subscriptionService.getUserActiveSubscription(testUserId);
      expect(activeSubscription).toBeDefined();
      expect(activeSubscription!.status).toBe(SubscriptionStatus.ACTIVE);
      expect(activeSubscription!.id).toBe(subscriptionId);
    });

    it('用户现在应该有有效订阅', async () => {
      const isSubscribed =
        await subscriptionService.isUserSubscribed(testUserId);
      expect(isSubscribed).toBe(true);
    });

    it('应该能够获取用户订阅历史', async () => {
      const history =
        await subscriptionService.getUserSubscriptionHistory(testUserId);
      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].id).toBe(subscriptionId);
      expect(history[0].status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('应该能够申请退款', async () => {
      const refundResponse = await subscriptionService.refundSubscription(
        subscriptionId,
        '测试退款',
      );

      expect(refundResponse.success).toBe(true);
      expect(refundResponse.message).toContain('退款申请成功');

      // 验证订阅已取消
      const cancelledSubscription =
        await subscriptionService.getUserActiveSubscription(testUserId);
      expect(cancelledSubscription).toBeNull();
    });
  });

  describe('自动plan选择功能测试', () => {
    it('1个月应该自动选择MONTHLY计划', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_AUTO_1M`,
        months_count: 1,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      expect(subscription.plan).toBe(SubscriptionPlan.MONTHLY);
    });

    it('3个月应该自动选择QUARTERLY计划', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_AUTO_3M`,
        months_count: 3,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      expect(subscription.plan).toBe(SubscriptionPlan.QUARTERLY);
    });

    it('12个月应该自动选择YEARLY计划', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_AUTO_12M`,
        months_count: 12,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      expect(subscription.plan).toBe(SubscriptionPlan.YEARLY);
    });

    it('6个月应该自动选择QUARTERLY计划以享受折扣', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_AUTO_6M`,
        months_count: 6,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      expect(subscription.plan).toBe(SubscriptionPlan.QUARTERLY);
    });

    it('24个月应该自动选择YEARLY计划以享受最大折扣', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_AUTO_24M`,
        months_count: 24,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      expect(subscription.plan).toBe(SubscriptionPlan.YEARLY);
    });
  });

  describe('特殊订单号控制支付结果', () => {
    it('包含SUCCESS的订单号应该自动成功', async () => {
      // 创建包含SUCCESS的订阅
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_SUCCESS`,
        months_count: 1,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscription.id,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_QR,
        );

      // 查询支付状态（应该因为包含SUCCESS而自动成功）
      const paymentRecord = await unitPayService.getPaymentRecord(
        paymentResponse.paymentId,
      );
      expect(paymentRecord).toBeDefined();

      // 使用包含SUCCESS的订单号查询
      const queryResponse = await unitPayService.queryPayment(
        paymentResponse.paymentId,
      );
      expect(queryResponse.status).toBe(PaymentStatus.SUCCESS);
    });

    it('包含FAILED的订单号应该自动失败', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_FAILED`,
        months_count: 1,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscription.id,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_QR,
        );

      // 查询支付状态（应该因为包含FAILED而自动失败）
      const queryResponse = await unitPayService.queryPayment(
        paymentResponse.paymentId,
      );
      expect(queryResponse.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('Mock支付方式测试', () => {
    it('MOCK_QR应该返回二维码URL', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_QR`,
        months_count: 1,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscription.id,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_QR,
        );

      expect(paymentResponse.payData.qrCode).toBeDefined();
      expect(paymentResponse.payData.qrCode).toContain('mock-payment.com/qr/');
    });

    it('MOCK_WEB应该返回支付表单', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_WEB`,
        months_count: 1,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscription.id,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_WEB,
        );

      expect(paymentResponse.payData.paymentUrl).toBeDefined();
      expect(paymentResponse.payData.paymentForm).toBeDefined();
      expect(paymentResponse.payData.paymentForm).toContain('<form');
    });

    it('MOCK_H5应该返回H5支付链接', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_H5`,
        months_count: 1,
        plan: SubscriptionPlan.MONTHLY,
      };

      const subscription =
        await subscriptionService.createSubscription(request);

      const paymentResponse =
        await subscriptionService.createSubscriptionPayment(
          subscription.id,
          PaymentProvider.MOCK,
          PaymentMethod.MOCK_H5,
        );

      expect(paymentResponse.payData.paymentUrl).toBeDefined();
      expect(paymentResponse.payData.paymentUrl).toContain(
        'mock-payment.com/h5/',
      );
    });
  });

  describe('订阅价格验证', () => {
    it('应该正确获取价格配置', () => {
      const pricing = subscriptionService.getPricing();

      expect(pricing.monthly_price).toBeGreaterThan(0);
      expect(pricing.quarterly_discount).toBeGreaterThan(0);
      expect(pricing.yearly_discount).toBeGreaterThan(0);
      expect(pricing.yearly_discount).toBeGreaterThan(
        pricing.quarterly_discount,
      );
    });

    it('创建的订阅应该有正确的价格', async () => {
      const request: CreateSubscriptionRequest = {
        user_id: `${testUserId}_PRICE_TEST`,
        months_count: 1,
        plan: SubscriptionPlan.MONTHLY,
      };

      const subscription =
        await subscriptionService.createSubscription(request);
      const pricing = subscriptionService.getPricing();

      expect(subscription.total_price).toBe(pricing.monthly_price);
      expect(subscription.price_per_month).toBe(pricing.monthly_price);
    });
  });
});
