/**
 * UnitPay支付系统使用示例
 *
 * 这个文件展示了如何使用UnitPay支付工具类
 */

import { UnitPayService } from '../unitPay.service';
import {
  PaymentProvider,
  PaymentMethod,
  PaymentConfig,
  CreatePaymentRequest,
} from '../types';
import { SubscriptionPlan } from 'src/types';
import { DBService } from 'src/common/db.service';

export class PaymentSystemExample {
  private unitPayService: UnitPayService;

  constructor() {
    // 注意：在实际应用中，这些服务应该通过依赖注入获得
    const dbService = new DBService();
    this.unitPayService = new UnitPayService(dbService);

    // 初始化支付配置
    this.initializePaymentProviders();
  }

  /**
   * 初始化支付提供商
   */
  private initializePaymentProviders(): void {
    const configs: PaymentConfig[] = [
      // 微信支付配置
      {
        provider: PaymentProvider.WECHAT,
        appId: 'wx1234567890abcdef',
        mchId: '1234567890',
        apiKey: 'your_wechat_api_key_here',
        notifyUrl: 'https://your-domain.com/payment/webhook/wechat',
        returnUrl: 'https://your-domain.com/payment/return',
        sandbox: true, // 沙箱环境
      },
      // 支付宝配置
      {
        provider: PaymentProvider.ALIPAY,
        appId: '2021001234567890',
        privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----`,
        publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`,
        notifyUrl: 'https://your-domain.com/payment/webhook/alipay',
        returnUrl: 'https://your-domain.com/payment/return',
        sandbox: true, // 沙箱环境
      },
    ];

    this.unitPayService.initialize(configs);
    console.log('支付提供商初始化完成');
  }

  /**
   * 示例1：创建微信扫码支付
   */
  async example1_CreateWechatQRPayment(): Promise<void> {
    console.log('=== 示例1：创建微信扫码支付 ===');

    const paymentRequest: CreatePaymentRequest = {
      orderId: `ORDER_${Date.now()}`,
      amount: 29.99,
      currency: 'CNY',
      subject: '订阅服务 - 月度计划',
      body: '1个月订阅服务',
      method: PaymentMethod.WECHAT_NATIVE,
      provider: PaymentProvider.WECHAT,
      userId: 'user_123',
      metadata: {
        subscriptionType: 'monthly',
        productType: 'subscription',
      },
    };

    try {
      const response = await this.unitPayService.createPayment(paymentRequest);

      if (response.success) {
        console.log('微信扫码支付创建成功:');
        console.log(`支付ID: ${response.paymentId}`);
        console.log(`二维码URL: ${response.payData?.qrCode}`);
        console.log(`第三方订单号: ${response.thirdPartyOrderId}`);
      } else {
        console.error('支付创建失败:', response.message);
      }
    } catch (error) {
      console.error('创建支付异常:', error);
    }

    console.log('');
  }

  /**
   * 示例2：创建支付宝网页支付
   */
  async example2_CreateAlipayWebPayment(): Promise<void> {
    console.log('=== 示例2：创建支付宝网页支付 ===');

    const paymentRequest: CreatePaymentRequest = {
      orderId: `ORDER_${Date.now()}`,
      amount: 89.97,
      currency: 'CNY',
      subject: '订阅服务 - 季度计划',
      body: '3个月订阅服务',
      method: PaymentMethod.ALIPAY_WEB,
      provider: PaymentProvider.ALIPAY,
      userId: 'user_456',
      metadata: {
        subscriptionType: 'quarterly',
        productType: 'subscription',
      },
    };

    try {
      const response = await this.unitPayService.createPayment(paymentRequest);

      if (response.success) {
        console.log('支付宝网页支付创建成功:');
        console.log(`支付ID: ${response.paymentId}`);
        console.log(
          `支付表单: ${response.payData?.paymentForm ? '已生成' : '未生成'}`,
        );
        console.log(`支付URL: ${response.payData?.paymentUrl}`);
      } else {
        console.error('支付创建失败:', response.message);
      }
    } catch (error) {
      console.error('创建支付异常:', error);
    }

    console.log('');
  }

  /**
   * 示例3：查询支付状态
   */
  async example3_QueryPaymentStatus(): Promise<void> {
    console.log('=== 示例3：查询支付状态 ===');

    // 首先创建一个支付
    const paymentRequest: CreatePaymentRequest = {
      orderId: `ORDER_${Date.now()}`,
      amount: 19.99,
      currency: 'CNY',
      subject: '测试支付',
      body: '支付状态查询测试',
      method: PaymentMethod.WECHAT_NATIVE,
      provider: PaymentProvider.WECHAT,
      userId: 'user_789',
    };

    try {
      const createResponse =
        await this.unitPayService.createPayment(paymentRequest);

      if (createResponse.success) {
        console.log(`支付创建成功，ID: ${createResponse.paymentId}`);

        // 查询支付状态
        const queryResponse = await this.unitPayService.queryPayment(
          createResponse.paymentId,
        );

        console.log('支付状态查询结果:');
        console.log(`支付状态: ${queryResponse.status}`);
        console.log(`支付金额: ${queryResponse.amount}`);
        console.log(`支付提供商: ${queryResponse.provider}`);
        console.log(`支付方式: ${queryResponse.method}`);

        if (queryResponse.paidAt) {
          console.log(`支付时间: ${queryResponse.paidAt}`);
        }

        if (queryResponse.failureReason) {
          console.log(`失败原因: ${queryResponse.failureReason}`);
        }
      }
    } catch (error) {
      console.error('查询支付状态异常:', error);
    }

    console.log('');
  }

  /**
   * 示例4：申请退款
   */
  async example4_RefundPayment(): Promise<void> {
    console.log('=== 示例4：申请退款 ===');

    // 这里假设有一个已支付的订单
    const paymentId = 'existing_payment_id';

    try {
      const refundResponse = await this.unitPayService.refundPayment(
        paymentId,
        29.99,
        '用户申请退款',
      );

      if (refundResponse.success) {
        console.log('退款申请成功:');
        console.log(`退款ID: ${refundResponse.refundId}`);
        console.log(`退款金额: ${refundResponse.refundAmount}`);
        console.log(`退款状态: ${refundResponse.status}`);
        console.log(`第三方退款ID: ${refundResponse.thirdPartyRefundId}`);
      } else {
        console.error('退款申请失败:', refundResponse.message);
      }
    } catch (error) {
      console.error('申请退款异常:', error);
    }

    console.log('');
  }

  /**
   * 示例5：获取用户支付历史
   */
  async example5_GetUserPaymentHistory(): Promise<void> {
    console.log('=== 示例5：获取用户支付历史 ===');

    const userId = 'user_123';

    try {
      const paymentHistory =
        await this.unitPayService.getUserPaymentHistory(userId);

      console.log(`用户 ${userId} 的支付历史 (共${paymentHistory.length}条):`);

      paymentHistory.forEach((payment, index) => {
        console.log(`${index + 1}. 订单ID: ${payment.orderId}`);
        console.log(`   金额: ${payment.amount} ${payment.currency}`);
        console.log(`   状态: ${payment.status}`);
        console.log(`   提供商: ${payment.provider}`);
        console.log(`   创建时间: ${payment.createdAt}`);
        console.log(`   ---`);
      });
    } catch (error) {
      console.error('获取支付历史异常:', error);
    }

    console.log('');
  }

  /**
   * 示例6：获取支付统计信息
   */
  async example6_GetPaymentStats(): Promise<void> {
    console.log('=== 示例6：获取支付统计信息 ===');

    try {
      // 获取全局统计
      const globalStats = await this.unitPayService.getPaymentStats();

      console.log('全局支付统计:');
      console.log(`总支付数: ${globalStats.total}`);
      console.log(`成功支付: ${globalStats.success}`);
      console.log(`待支付: ${globalStats.pending}`);
      console.log(`失败支付: ${globalStats.failed}`);
      console.log(`已退款: ${globalStats.refunded}`);
      console.log(`总金额: ${globalStats.totalAmount}`);
      console.log(`成功金额: ${globalStats.successAmount}`);
      console.log(`退款金额: ${globalStats.refundedAmount}`);

      // 获取特定用户统计
      const userStats = await this.unitPayService.getPaymentStats('user_123');

      console.log('\n用户 user_123 支付统计:');
      console.log(`用户支付数: ${userStats.total}`);
      console.log(`用户成功支付: ${userStats.success}`);
      console.log(`用户支付金额: ${userStats.totalAmount}`);
    } catch (error) {
      console.error('获取支付统计异常:', error);
    }

    console.log('');
  }

  /**
   * 示例7：检查支付方式可用性
   */
  async example7_CheckPaymentMethods(): Promise<void> {
    console.log('=== 示例7：检查支付方式可用性 ===');

    // 检查特定支付方式
    const wechatNativeAvailable = this.unitPayService.isPaymentMethodAvailable(
      PaymentProvider.WECHAT,
      PaymentMethod.WECHAT_NATIVE,
    );

    const alipayWebAvailable = this.unitPayService.isPaymentMethodAvailable(
      PaymentProvider.ALIPAY,
      PaymentMethod.ALIPAY_WEB,
    );

    console.log(`微信扫码支付可用: ${wechatNativeAvailable}`);
    console.log(`支付宝网页支付可用: ${alipayWebAvailable}`);

    // 获取所有可用支付方式
    const availableMethods = this.unitPayService.getAvailablePaymentMethods();

    console.log('\n所有可用支付方式:');
    availableMethods.forEach((providerMethods) => {
      console.log(`${providerMethods.provider}:`);
      providerMethods.methods.forEach((method) => {
        console.log(`  - ${method}`);
      });
    });

    console.log('');
  }

  /**
   * 运行所有示例
   */
  async runAllExamples(): Promise<void> {
    try {
      await this.example1_CreateWechatQRPayment();
      await this.example2_CreateAlipayWebPayment();
      await this.example3_QueryPaymentStatus();
      await this.example4_RefundPayment();
      await this.example5_GetUserPaymentHistory();
      await this.example6_GetPaymentStats();
      await this.example7_CheckPaymentMethods();

      console.log('=== 所有支付示例运行完成 ===');
    } catch (error) {
      console.error('运行示例时出错:', error);
    } finally {
      // 关闭支付提供商连接
      await this.unitPayService.close();
    }
  }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  const example = new PaymentSystemExample();
  example.runAllExamples();
}
