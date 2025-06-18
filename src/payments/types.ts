export enum PaymentProvider {
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  MOCK = 'mock', // 测试用Mock支付
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIAL_REFUNDED = 'partial_refunded',
}

export enum PaymentMethod {
  // 微信支付方式
  WECHAT_JSAPI = 'wechat_jsapi', // 微信内H5支付
  WECHAT_NATIVE = 'wechat_native', // 微信扫码支付
  WECHAT_APP = 'wechat_app', // 微信APP支付
  WECHAT_H5 = 'wechat_h5', // 微信H5支付

  // 支付宝支付方式
  ALIPAY_WEB = 'alipay_web', // 支付宝网页支付
  ALIPAY_WAP = 'alipay_wap', // 支付宝手机网页支付
  ALIPAY_APP = 'alipay_app', // 支付宝APP支付
  ALIPAY_QR = 'alipay_qr', // 支付宝扫码支付

  // Mock支付方式（测试用）
  MOCK_QR = 'mock_qr', // Mock扫码支付
  MOCK_WEB = 'mock_web', // Mock网页支付
  MOCK_H5 = 'mock_h5', // Mock H5支付

  // 其他支付方式
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
}

export interface PaymentConfig {
  provider: PaymentProvider;
  appId?: string;
  mchId?: string;
  apiKey?: string;
  privateKey?: string;
  publicKey?: string;
  alipayPublicKey?: string; // 支付宝公钥
  notifyUrl?: string;
  returnUrl?: string;
  sandbox?: boolean;
  [key: string]: any;
}

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  subject: string;
  body?: string;
  method: PaymentMethod;
  provider: PaymentProvider;
  userId?: string;
  openid?: string; // 微信JSAPI支付需要的用户openid
  metadata?: Record<string, any>;
  expireTime?: Date;
  notifyUrl?: string;
  returnUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  status: PaymentStatus;
  payData?: any; // 支付数据，如二维码URL、支付表单等
  message?: string;
  thirdPartyOrderId?: string;
  createdAt: Date;
  expireTime?: Date;
}

export interface QueryPaymentRequest {
  paymentId?: string;
  orderId?: string;
  thirdPartyOrderId?: string;
}

export interface QueryPaymentResponse {
  success: boolean;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt?: Date;
  failureReason?: string;
  thirdPartyOrderId?: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  refundAmount?: number; // 不传则全额退款
  reason?: string;
  refundId?: string; // 商户退款单号
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  paymentId: string;
  refundAmount: number;
  status: PaymentStatus;
  thirdPartyRefundId?: string;
  message?: string;
  refundedAt?: Date;
}

export interface WebhookData {
  provider: PaymentProvider;
  event: string;
  paymentId?: string;
  orderId?: string;
  status?: PaymentStatus;
  amount?: number;
  paidAt?: Date;
  rawData: any;
  signature?: string;
}

export interface PaymentProviderInterface {
  createPayment(request: CreatePaymentRequest): Promise<PaymentResponse>;
  queryPayment(request: QueryPaymentRequest): Promise<QueryPaymentResponse>;
  refundPayment(request: RefundRequest): Promise<RefundResponse>;
  verifyWebhook(data: any, signature?: string): Promise<WebhookData>;
  close(): Promise<void>;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId?: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  status: PaymentStatus;
  subject: string;
  body?: string;
  thirdPartyOrderId?: string;
  payData?: any;
  metadata?: Record<string, any>;
  createdAt: Date;
  paidAt?: Date;
  expireTime?: Date;
  failureReason?: string;
  updatedAt: Date;
}
