import { PaymentProviderInterface } from '../types';
import {
  PaymentConfig,
  CreatePaymentRequest,
  PaymentResponse,
  QueryPaymentRequest,
  QueryPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookData,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MockPayProvider implements PaymentProviderInterface {
  private config: PaymentConfig;
  private paymentRecords: Map<string, any> = new Map();

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    return new Promise((resolve) => {
      const thirdPartyOrderId = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 简化payData，只返回基本信息字符串
      const payData = `Mock支付订单已创建，订单号：${thirdPartyOrderId}`;

      // 存储支付记录用于后续查询
      this.paymentRecords.set(thirdPartyOrderId, {
        orderId: request.orderId,
        amount: request.amount,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        request,
      });

      resolve({
        success: true,
        paymentId: request.orderId || thirdPartyOrderId,
        orderId: request.orderId || thirdPartyOrderId,
        amount: request.amount,
        currency: request.currency,
        provider: PaymentProvider.MOCK,
        method: request.method,
        thirdPartyOrderId,
        status: PaymentStatus.PENDING,
        payData,
        message: 'Mock支付订单创建成功',
        createdAt: new Date(),
      });
    });
  }

  queryPayment(request: QueryPaymentRequest): Promise<QueryPaymentResponse> {
    return new Promise((resolve) => {
      const record = this.paymentRecords.get(
        request.thirdPartyOrderId || request.orderId!,
      );

      if (!record) {
        resolve({
          success: false,
          paymentId: request.paymentId || '',
          orderId: request.orderId || '',
          amount: 0,
          currency: 'CNY',
          provider: PaymentProvider.MOCK,
          method: PaymentMethod.MOCK_QR,
          status: PaymentStatus.FAILED,
          failureReason: '订单不存在',
        });
        return;
      }

      // Mock支付：默认返回支付中状态，可以通过特殊订单号控制结果
      let status = record.status;

      // 特殊订单号控制支付结果
      const orderId = request.orderId || request.thirdPartyOrderId || '';
      if (orderId.includes('SUCCESS')) {
        status = PaymentStatus.SUCCESS;
        record.status = PaymentStatus.SUCCESS;
        record.paidAt = new Date();
      } else if (orderId.includes('FAILED')) {
        status = PaymentStatus.FAILED;
        record.status = PaymentStatus.FAILED;
      } else if (orderId.includes('CANCELLED')) {
        status = PaymentStatus.CANCELLED;
        record.status = PaymentStatus.CANCELLED;
      }

      resolve({
        success: true,
        paymentId: request.paymentId || record.orderId,
        orderId: record.orderId,
        amount: record.amount,
        currency: 'CNY',
        provider: PaymentProvider.MOCK,
        method: record.request.method,
        status,
        paidAt: record.paidAt,
        thirdPartyOrderId: request.thirdPartyOrderId,
        metadata: record.request.metadata,
      });
    });
  }

  refundPayment(request: RefundRequest): Promise<RefundResponse> {
    return new Promise((resolve) => {
      const record = this.paymentRecords.get(request.paymentId);

      if (!record) {
        resolve({
          success: false,
          refundId: '',
          paymentId: request.paymentId,
          refundAmount: 0,
          status: PaymentStatus.FAILED,
          message: '订单不存在',
        });
        return;
      }

      if (record.status !== PaymentStatus.SUCCESS) {
        resolve({
          success: false,
          refundId: '',
          paymentId: request.paymentId,
          refundAmount: 0,
          status: record.status,
          message: '只有支付成功的订单才能申请退款',
        });
        return;
      }

      // Mock退款成功
      record.status = PaymentStatus.REFUNDED;
      record.refundedAt = new Date();

      resolve({
        success: true,
        refundId: `REFUND_${Date.now()}`,
        paymentId: request.paymentId,
        refundAmount: request.refundAmount || record.amount,
        status: PaymentStatus.REFUNDED,
        message: 'Mock退款成功',
        refundedAt: new Date(),
      });
    });
  }

  verifyWebhook(data: any, signature?: string): Promise<WebhookData> {
    return Promise.resolve({
      provider: PaymentProvider.MOCK,
      event: 'payment_success',
      paymentId: data.orderId,
      orderId: data.orderId,
      status: data.status || PaymentStatus.SUCCESS,
      amount: data.amount,
      paidAt: new Date(),
      rawData: data,
      signature,
      thirdPartyOrderId: data.thirdPartyOrderId,
    });
  }

  close(): Promise<void> {
    // Mock provider无需关闭连接
    this.paymentRecords.clear();
    return Promise.resolve();
  }

  /**
   * Mock支付成功 - 测试用
   */
  mockPaymentSuccess(orderId: string): boolean {
    for (const [key, record] of this.paymentRecords.entries()) {
      if (record.orderId === orderId) {
        record.status = PaymentStatus.SUCCESS;
        record.paidAt = new Date();
        return true;
      }
    }
    return false;
  }

  /**
   * Mock支付失败 - 测试用
   */
  mockPaymentFailure(
    orderId: string,
    reason: string = 'Mock支付失败',
  ): boolean {
    for (const [key, record] of this.paymentRecords.entries()) {
      if (record.orderId === orderId) {
        record.status = PaymentStatus.FAILED;
        record.failureReason = reason;
        return true;
      }
    }
    return false;
  }

  /**
   * 获取所有Mock支付记录 - 测试用
   */
  getMockPaymentRecords(): Array<any> {
    return Array.from(this.paymentRecords.values());
  }
}
