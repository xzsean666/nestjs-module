import {
  PaymentProviderInterface,
  CreatePaymentRequest,
  PaymentResponse,
  QueryPaymentRequest,
  QueryPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookData,
  PaymentConfig,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as WechatPay from 'wechatpay-nodejs-sdk';

export class WechatPayProvider implements PaymentProviderInterface {
  private config: PaymentConfig;
  private wechatPay: any;

  constructor(config: PaymentConfig) {
    this.config = config;
    this.validateConfig();
    this.initializeSdk();
  }

  private validateConfig(): void {
    const required = ['appId', 'mchId', 'privateKey', 'publicKey', 'apiKey'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`微信支付配置缺少必要字段: ${field}`);
      }
    }
  }

  private initializeSdk(): void {
    this.wechatPay = new WechatPay({
      appid: this.config.appId!,
      mchid: this.config.mchId!,
      publicKey: this.config.publicKey!,
      privateKey: this.config.privateKey!,
      secretKey: this.config.apiKey!,
    });
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    try {
      const paymentId = `wechat_${uuidv4()}`;
      const thirdPartyOrderId = `WX${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      let payData: any;

      switch (request.method) {
        case PaymentMethod.WECHAT_NATIVE:
          payData = await this.createNativePay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.WECHAT_JSAPI:
          payData = await this.createJSAPIPay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.WECHAT_APP:
          payData = await this.createAPPPay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.WECHAT_H5:
          payData = await this.createH5Pay(request, thirdPartyOrderId);
          break;
        default:
          throw new Error(`不支持的微信支付方式: ${request.method}`);
      }

      return {
        success: true,
        paymentId,
        orderId: request.orderId,
        amount: request.amount,
        currency: request.currency,
        provider: PaymentProvider.WECHAT,
        method: request.method,
        status: PaymentStatus.PENDING,
        payData,
        thirdPartyOrderId,
        createdAt: new Date(),
        expireTime: request.expireTime,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: '',
        orderId: request.orderId,
        amount: request.amount,
        currency: request.currency,
        provider: PaymentProvider.WECHAT,
        method: request.method,
        status: PaymentStatus.FAILED,
        message: error.message,
        createdAt: new Date(),
      };
    }
  }

  async queryPayment(
    request: QueryPaymentRequest,
  ): Promise<QueryPaymentResponse> {
    try {
      const result = await this.wechatPay.query({
        out_trade_no: request.orderId,
      });

      return {
        success: result.trade_state === 'SUCCESS',
        paymentId: request.paymentId || '',
        orderId: request.orderId || '',
        amount: parseInt(result.total_fee || '0') / 100,
        currency: 'CNY',
        provider: PaymentProvider.WECHAT,
        method: PaymentMethod.WECHAT_NATIVE,
        status: this.mapWechatStatus(result.trade_state),
        paidAt: result.time_end
          ? this.parseWechatTime(result.time_end)
          : undefined,
        thirdPartyOrderId: result.transaction_id,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: request.paymentId || '',
        orderId: request.orderId || '',
        amount: 0,
        currency: 'CNY',
        provider: PaymentProvider.WECHAT,
        method: PaymentMethod.WECHAT_NATIVE,
        status: PaymentStatus.FAILED,
        failureReason: error.message,
      };
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundId = request.refundId || `RF${Date.now()}`;
      const refundAmount = request.refundAmount || 0;

      const result = await this.wechatPay.refund({
        out_trade_no: request.paymentId,
        out_refund_no: refundId,
        total_fee: Math.round(refundAmount * 100),
        refund_fee: Math.round(refundAmount * 100),
        refund_desc: request.reason || '订阅退款',
      });

      return {
        success:
          result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS',
        refundId,
        paymentId: request.paymentId,
        refundAmount,
        status:
          result.return_code === 'SUCCESS'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.FAILED,
        thirdPartyRefundId: result.refund_id,
        message: result.err_code_des,
        refundedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        refundId: request.refundId || '',
        paymentId: request.paymentId,
        refundAmount: request.refundAmount || 0,
        status: PaymentStatus.FAILED,
        message: error.message,
      };
    }
  }

  verifyWebhook(data: any, signature?: string): Promise<WebhookData> {
    try {
      const result = this.wechatPay.verifySign({
        body: data,
        signature: signature || data.signature,
        serial: data.serial,
        nonce: data.nonce,
        timestamp: data.timestamp,
      });

      if (!result) {
        throw new Error('微信支付回调签名验证失败');
      }

      return Promise.resolve({
        provider: PaymentProvider.WECHAT,
        event: 'payment_success',
        paymentId: data.out_trade_no,
        orderId: data.out_trade_no,
        status: this.mapWechatStatus(
          data.result_code === 'SUCCESS' ? 'SUCCESS' : 'FAIL',
        ),
        amount: parseInt(data.total_fee) / 100,
        paidAt: this.parseWechatTime(data.time_end),
        rawData: data,
        signature,
      });
    } catch (error) {
      throw new Error(`微信支付回调验证失败: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // 微信支付不需要特殊的关闭操作
  }

  private async createNativePay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const result = await this.wechatPay.transactions_native({
      description: request.subject,
      out_trade_no: thirdPartyOrderId,
      notify_url: request.notifyUrl || this.config.notifyUrl!,
      amount: { total: Math.round(request.amount * 100) },
      scene_info: { payer_client_ip: '127.0.0.1' },
    });

    return {
      qrCode: result.code_url,
      prepayId: result.prepay_id,
    };
  }

  private async createJSAPIPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const result = await this.wechatPay.transactions_jsapi({
      description: request.subject,
      out_trade_no: thirdPartyOrderId,
      notify_url: request.notifyUrl || this.config.notifyUrl!,
      amount: { total: Math.round(request.amount * 100) },
      payer: { openid: request.openid || '' },
    });

    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const prepayIdPackage = `prepay_id=${result.prepay_id}`;

    return {
      appId: this.config.appId,
      timeStamp,
      nonceStr,
      package: prepayIdPackage,
      signType: 'RSA',
      paySign: this.wechatPay.buildRequestSign({
        method: 'POST',
        url: '/v3/pay/transactions/jsapi',
        timestamp: timeStamp,
        nonce: nonceStr,
        body: JSON.stringify({
          appid: this.config.appId,
          mchid: this.config.mchId,
          prepay_id: result.prepay_id,
        }),
      }),
    };
  }

  private async createAPPPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const result = await this.wechatPay.transactions_app({
      description: request.subject,
      out_trade_no: thirdPartyOrderId,
      notify_url: request.notifyUrl || this.config.notifyUrl!,
      amount: { total: Math.round(request.amount * 100) },
    });

    return {
      appid: this.config.appId,
      partnerid: this.config.mchId,
      prepayid: result.prepay_id,
      package: 'Sign=WXPay',
      noncestr: this.generateNonceStr(),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  private async createH5Pay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const result = await this.wechatPay.transactions_h5({
      description: request.subject,
      out_trade_no: thirdPartyOrderId,
      notify_url: request.notifyUrl || this.config.notifyUrl!,
      amount: { total: Math.round(request.amount * 100) },
      scene_info: {
        payer_client_ip: '127.0.0.1',
        h5_info: {
          type: 'Wap',
          app_name: 'WordFlow',
          app_url: request.returnUrl || 'https://wordflow.com',
        },
      },
    });

    return {
      h5_url: result.h5_url,
      prepayId: result.prepay_id,
    };
  }

  private generateNonceStr(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  private mapWechatStatus(status: string): PaymentStatus {
    switch (status) {
      case 'SUCCESS':
        return PaymentStatus.SUCCESS;
      case 'REFUND':
        return PaymentStatus.REFUNDED;
      case 'NOTPAY':
        return PaymentStatus.PENDING;
      case 'CLOSED':
        return PaymentStatus.CANCELLED;
      case 'REVOKED':
        return PaymentStatus.CANCELLED;
      case 'USERPAYING':
        return PaymentStatus.PENDING;
      case 'PAYERROR':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private parseWechatTime(timeStr: string): Date {
    // 微信时间格式: 20191122173022
    const year = parseInt(timeStr.substring(0, 4));
    const month = parseInt(timeStr.substring(4, 6)) - 1;
    const day = parseInt(timeStr.substring(6, 8));
    const hour = parseInt(timeStr.substring(8, 10));
    const minute = parseInt(timeStr.substring(10, 12));
    const second = parseInt(timeStr.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }
}
