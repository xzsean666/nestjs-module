import { AlipayProvider } from '../providers/alipay.provider';
import { WechatPayProvider } from '../providers/wechat.provider';
import {
  PaymentProvider,
  PaymentMethod,
  CreatePaymentRequest,
  PaymentConfig,
} from '../types';

/**
 * 官方 SDK 使用示例
 * 演示如何使用重构后的支付宝和微信支付提供者
 */

async function exampleAlipayPayment(): Promise<void> {
  // 支付宝配置
  const alipayConfig: PaymentConfig = {
    provider: PaymentProvider.ALIPAY,
    appId: 'your_alipay_app_id',
    privateKey: 'your_alipay_private_key',
    alipayPublicKey: 'alipay_public_key',
    notifyUrl: 'https://yoursite.com/notify/alipay',
    returnUrl: 'https://yoursite.com/return',
    sandbox: true, // 开发环境使用沙箱
  };

  const alipayProvider = new AlipayProvider(alipayConfig);

  // 创建支付宝网页支付
  const request: CreatePaymentRequest = {
    orderId: 'ORDER_' + Date.now(),
    amount: 0.01, // 1分钱测试
    currency: 'CNY',
    subject: '测试订单',
    body: '这是一个测试订单',
    method: PaymentMethod.ALIPAY_WEB,
    provider: PaymentProvider.ALIPAY,
    userId: 'user123',
  };

  try {
    const paymentResult = await alipayProvider.createPayment(request);
    console.log('支付宝支付创建结果:', paymentResult);

    if (paymentResult.success) {
      // 查询支付状态
      const queryResult = await alipayProvider.queryPayment({
        orderId: request.orderId,
      });
      console.log('支付状态查询结果:', queryResult);
    }
  } catch (error) {
    console.error('支付宝支付错误:', error);
  }
}

async function exampleWechatPayment(): Promise<void> {
  // 微信支付配置
  const wechatConfig: PaymentConfig = {
    provider: PaymentProvider.WECHAT,
    appId: 'your_wechat_app_id',
    mchId: 'your_merchant_id',
    privateKey: 'your_wechat_private_key',
    publicKey: 'your_wechat_public_key',
    apiKey: 'your_api_v3_key',
    notifyUrl: 'https://yoursite.com/notify/wechat',
    sandbox: true,
  };

  const wechatProvider = new WechatPayProvider(wechatConfig);

  // 创建微信扫码支付
  const request: CreatePaymentRequest = {
    orderId: 'ORDER_' + Date.now(),
    amount: 0.01,
    currency: 'CNY',
    subject: '测试订单',
    body: '这是一个微信支付测试订单',
    method: PaymentMethod.WECHAT_NATIVE,
    provider: PaymentProvider.WECHAT,
    userId: 'user123',
  };

  try {
    const paymentResult = await wechatProvider.createPayment(request);
    console.log('微信支付创建结果:', paymentResult);

    if (paymentResult.success) {
      // 查询支付状态
      const queryResult = await wechatProvider.queryPayment({
        orderId: request.orderId,
      });
      console.log('支付状态查询结果:', queryResult);
    }
  } catch (error) {
    console.error('微信支付错误:', error);
  }
}

async function exampleWechatJSAPI(): Promise<void> {
  const wechatConfig: PaymentConfig = {
    provider: PaymentProvider.WECHAT,
    appId: 'your_wechat_app_id',
    mchId: 'your_merchant_id',
    privateKey: 'your_wechat_private_key',
    publicKey: 'your_wechat_public_key',
    apiKey: 'your_api_v3_key',
    notifyUrl: 'https://yoursite.com/notify/wechat',
  };

  const wechatProvider = new WechatPayProvider(wechatConfig);

  // 创建微信 JSAPI 支付（需要用户的 openid）
  const request: CreatePaymentRequest = {
    orderId: 'ORDER_' + Date.now(),
    amount: 0.01,
    currency: 'CNY',
    subject: '测试 JSAPI 订单',
    method: PaymentMethod.WECHAT_JSAPI,
    provider: PaymentProvider.WECHAT,
    openid: 'user_openid_from_wechat', // 用户的微信 openid
  };

  try {
    const paymentResult = await wechatProvider.createPayment(request);
    console.log('微信 JSAPI 支付创建结果:', paymentResult);

    // paymentResult.payData 包含前端调用支付所需的参数
    if (paymentResult.success) {
      console.log('前端调用支付参数:', paymentResult.payData);
    }
  } catch (error) {
    console.error('微信 JSAPI 支付错误:', error);
  }
}

async function examplePaymentRefund(): Promise<void> {
  const alipayConfig: PaymentConfig = {
    provider: PaymentProvider.ALIPAY,
    appId: 'your_alipay_app_id',
    privateKey: 'your_alipay_private_key',
    alipayPublicKey: 'alipay_public_key',
    sandbox: true,
  };

  const alipayProvider = new AlipayProvider(alipayConfig);

  try {
    // 退款示例
    const refundResult = await alipayProvider.refundPayment({
      paymentId: 'existing_payment_order_id',
      refundAmount: 0.01,
      reason: '用户申请退款',
      refundId: 'REFUND_' + Date.now(),
    });

    console.log('退款结果:', refundResult);
  } catch (error) {
    console.error('退款错误:', error);
  }
}

async function exampleWebhookVerification(): Promise<void> {
  const alipayConfig: PaymentConfig = {
    provider: PaymentProvider.ALIPAY,
    appId: 'your_alipay_app_id',
    privateKey: 'your_alipay_private_key',
    alipayPublicKey: 'alipay_public_key',
  };

  const alipayProvider = new AlipayProvider(alipayConfig);

  // 模拟支付宝回调数据
  const mockNotifyData = {
    gmt_create: '2023-12-01 12:00:00',
    charset: 'utf-8',
    gmt_payment: '2023-12-01 12:00:05',
    notify_time: '2023-12-01 12:00:10',
    subject: '测试订单',
    sign: 'mock_signature',
    buyer_id: '2088123456789012',
    invoice_amount: '0.01',
    version: '1.0',
    notify_id: 'ac05099524730693a8b330c5ecf72da9786',
    fund_bill_list: '[{"amount":"0.01","fundChannel":"ALIPAYACCOUNT"}]',
    notify_type: 'trade_status_sync',
    out_trade_no: 'ORDER_1701417600000',
    total_amount: '0.01',
    trade_status: 'TRADE_SUCCESS',
    trade_no: '2023120122001456781234567890',
    auth_app_id: 'your_alipay_app_id',
    receipt_amount: '0.01',
    point_amount: '0.00',
    app_id: 'your_alipay_app_id',
    buyer_pay_amount: '0.01',
    sign_type: 'RSA2',
    seller_id: '2088123456789012',
  };

  try {
    const webhookData = await alipayProvider.verifyWebhook(mockNotifyData);
    console.log('回调验证结果:', webhookData);
  } catch (error) {
    console.error('回调验证失败:', error);
  }
}

// 运行示例
async function runExamples(): Promise<void> {
  console.log('=== 支付宝支付示例 ===');
  await exampleAlipayPayment();

  console.log('\n=== 微信扫码支付示例 ===');
  await exampleWechatPayment();

  console.log('\n=== 微信 JSAPI 支付示例 ===');
  await exampleWechatJSAPI();

  console.log('\n=== 退款示例 ===');
  await examplePaymentRefund();

  console.log('\n=== 回调验证示例 ===');
  await exampleWebhookVerification();
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  exampleAlipayPayment,
  exampleWechatPayment,
  exampleWechatJSAPI,
  examplePaymentRefund,
  exampleWebhookVerification,
};
