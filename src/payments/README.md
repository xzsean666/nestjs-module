# 支付系统 - 官方 SDK 版本

这是一个使用官方 SDK 重构的支付系统，支持支付宝和微信支付。

## 主要改进

### 1. 使用官方 SDK

- **支付宝**: 使用 `alipay-sdk` (v4.14.0) - 支付宝官方 Node.js SDK
- **微信支付**: 使用 `wechatpay-nodejs-sdk` (v0.0.7) - 微信支付 Node.js SDK

### 2. 修复的问题

- 移除了手动签名实现，使用官方 SDK 处理签名
- 修复了所有 linter 错误（async 方法无 await 表达式）
- 改进了错误处理和类型安全
- 使用官方 API v3 协议

## 安装依赖

```bash
npm install alipay-sdk wechatpay-nodejs-sdk
```

## 配置说明

### 支付宝配置

```typescript
const alipayConfig: PaymentConfig = {
  provider: PaymentProvider.ALIPAY,
  appId: 'your_alipay_app_id', // 支付宝应用 ID
  privateKey: 'your_alipay_private_key', // 应用私钥
  alipayPublicKey: 'alipay_public_key', // 支付宝公钥
  notifyUrl: 'https://yoursite.com/notify/alipay',
  returnUrl: 'https://yoursite.com/return',
  sandbox: true, // 开发环境使用沙箱
};
```

### 微信支付配置

```typescript
const wechatConfig: PaymentConfig = {
  provider: PaymentProvider.WECHAT,
  appId: 'your_wechat_app_id', // 微信应用 ID
  mchId: 'your_merchant_id', // 商户号
  privateKey: 'your_wechat_private_key', // 商户私钥
  publicKey: 'your_wechat_public_key', // 商户公钥证书
  apiKey: 'your_api_v3_key', // API v3 密钥
  notifyUrl: 'https://yoursite.com/notify/wechat',
};
```

## 使用示例

### 支付宝网页支付

```typescript
import { AlipayProvider } from './providers/alipay.provider';

const alipayProvider = new AlipayProvider(alipayConfig);

const paymentResult = await alipayProvider.createPayment({
  orderId: 'ORDER_' + Date.now(),
  amount: 0.01,
  currency: 'CNY',
  subject: '测试订单',
  method: PaymentMethod.ALIPAY_WEB,
  provider: PaymentProvider.ALIPAY,
});

console.log(paymentResult.payData.paymentForm); // 支付表单 HTML
console.log(paymentResult.payData.paymentUrl); // 支付链接
```

### 微信扫码支付

```typescript
import { WechatPayProvider } from './providers/wechat.provider';

const wechatProvider = new WechatPayProvider(wechatConfig);

const paymentResult = await wechatProvider.createPayment({
  orderId: 'ORDER_' + Date.now(),
  amount: 0.01,
  currency: 'CNY',
  subject: '测试订单',
  method: PaymentMethod.WECHAT_NATIVE,
  provider: PaymentProvider.WECHAT,
});

console.log(paymentResult.payData.qrCode); // 二维码链接
```

### 微信 JSAPI 支付

```typescript
const paymentResult = await wechatProvider.createPayment({
  orderId: 'ORDER_' + Date.now(),
  amount: 0.01,
  currency: 'CNY',
  subject: '测试 JSAPI 订单',
  method: PaymentMethod.WECHAT_JSAPI,
  provider: PaymentProvider.WECHAT,
  openid: 'user_openid_from_wechat', // 用户的微信 openid
});

// paymentResult.payData 包含前端调用 wx.requestPayment 所需的参数
```

### 查询支付状态

```typescript
const queryResult = await paymentProvider.queryPayment({
  orderId: 'your_order_id',
});

console.log(queryResult.status); // 支付状态
```

### 申请退款

```typescript
const refundResult = await paymentProvider.refundPayment({
  paymentId: 'payment_order_id',
  refundAmount: 0.01,
  reason: '用户申请退款',
});

console.log(refundResult.success);
```

### 验证回调签名

```typescript
// 在回调接口中验证签名
app.post('/notify/alipay', async (req, res) => {
  try {
    const webhookData = await alipayProvider.verifyWebhook(req.body);

    if (webhookData.status === PaymentStatus.SUCCESS) {
      // 处理支付成功逻辑
      console.log('支付成功:', webhookData.orderId);
    }

    res.send('success');
  } catch (error) {
    console.error('回调验证失败:', error);
    res.status(400).send('fail');
  }
});
```

## 支持的支付方式

### 支付宝

- `ALIPAY_WEB`: 网页支付
- `ALIPAY_WAP`: 手机网页支付
- `ALIPAY_APP`: APP 支付
- `ALIPAY_QR`: 扫码支付

### 微信支付

- `WECHAT_NATIVE`: 扫码支付
- `WECHAT_JSAPI`: 公众号/小程序支付
- `WECHAT_APP`: APP 支付
- `WECHAT_H5`: H5 支付

## API 说明

### 支付状态

- `PENDING`: 待支付
- `SUCCESS`: 支付成功
- `FAILED`: 支付失败
- `CANCELLED`: 已取消
- `REFUNDED`: 已退款

### 主要接口

- `createPayment()`: 创建支付
- `queryPayment()`: 查询支付状态
- `refundPayment()`: 申请退款
- `verifyWebhook()`: 验证回调签名

## 注意事项

1. **证书配置**: 确保正确配置私钥和公钥证书
2. **回调地址**: 确保回调地址可以被外网访问
3. **签名验证**: 务必验证回调签名以确保安全性
4. **沙箱测试**: 开发环境使用沙箱进行测试
5. **错误处理**: 注意处理网络错误和业务错误

## 示例文件

查看 `examples/sdk-usage-example.ts` 了解更多使用示例。

## 技术支持

- 支付宝开发文档: https://opendocs.alipay.com/
- 微信支付开发文档: https://pay.weixin.qq.com/wiki/doc/api/
