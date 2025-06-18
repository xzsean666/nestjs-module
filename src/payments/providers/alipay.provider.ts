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
import { AlipaySdk } from 'alipay-sdk';

export class AlipayProvider implements PaymentProviderInterface {
  private config: PaymentConfig;
  private alipaySdk: AlipaySdk;

  constructor(config: PaymentConfig) {
    this.config = config;
    this.validateConfig();
    this.initializeSdk();
  }

  private validateConfig(): void {
    const required = ['appId', 'privateKey', 'alipayPublicKey'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`支付宝配置缺少必要字段: ${field}`);
      }
    }
  }

  private initializeSdk(): void {
    this.alipaySdk = new AlipaySdk({
      appId: this.config.appId!,
      privateKey: this.config.privateKey!,
      alipayPublicKey: this.config.alipayPublicKey!,
      keyType: 'PKCS1',
      gateway: this.config.sandbox
        ? 'https://openapi.alipaydev.com/gateway.do'
        : 'https://openapi.alipay.com/gateway.do',
    });
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    try {
      const paymentId = `alipay_${uuidv4()}`;
      const thirdPartyOrderId = `ALI${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      let payData: any;

      switch (request.method) {
        case PaymentMethod.ALIPAY_WEB:
          payData = await this.createWebPay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.ALIPAY_WAP:
          payData = await this.createWapPay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.ALIPAY_APP:
          payData = await this.createAppPay(request, thirdPartyOrderId);
          break;
        case PaymentMethod.ALIPAY_QR:
          payData = await this.createQRPay(request, thirdPartyOrderId);
          break;
        default:
          throw new Error(`不支持的支付宝支付方式: ${request.method}`);
      }

      return {
        success: true,
        paymentId,
        orderId: request.orderId,
        amount: request.amount,
        currency: request.currency,
        provider: PaymentProvider.ALIPAY,
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
        provider: PaymentProvider.ALIPAY,
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
      const result = await this.alipaySdk.curl(
        'POST',
        '/v3/alipay/trade/query',
        {
          body: {
            out_trade_no: request.orderId,
          },
        },
      );

      if (result.responseHttpStatus === 200 && result.data.code === '10000') {
        return {
          success: true,
          paymentId: request.paymentId || '',
          orderId: request.orderId || '',
          amount: parseFloat(result.data.total_amount || '0'),
          currency: 'CNY',
          provider: PaymentProvider.ALIPAY,
          method: PaymentMethod.ALIPAY_WEB,
          status: this.mapAlipayStatus(result.data.trade_status),
          paidAt: result.data.send_pay_date
            ? new Date(result.data.send_pay_date)
            : undefined,
          thirdPartyOrderId: result.data.trade_no,
        };
      } else {
        throw new Error(result.data.sub_msg || '查询失败');
      }
    } catch (error) {
      return {
        success: false,
        paymentId: request.paymentId || '',
        orderId: request.orderId || '',
        amount: 0,
        currency: 'CNY',
        provider: PaymentProvider.ALIPAY,
        method: PaymentMethod.ALIPAY_WEB,
        status: PaymentStatus.FAILED,
        failureReason: error.message,
      };
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundId = request.refundId || `RF${Date.now()}`;

      const result = await this.alipaySdk.curl(
        'POST',
        '/v3/alipay/trade/refund',
        {
          body: {
            out_trade_no: request.paymentId,
            refund_amount: request.refundAmount,
            refund_reason: request.reason || '订阅退款',
            out_refund_no: refundId,
          },
        },
      );

      if (result.responseHttpStatus === 200 && result.data.code === '10000') {
        return {
          success: true,
          refundId,
          paymentId: request.paymentId,
          refundAmount: parseFloat(result.data.refund_fee || '0'),
          status: PaymentStatus.REFUNDED,
          thirdPartyRefundId: result.data.trade_no,
          message: result.data.msg,
          refundedAt: new Date(),
        };
      } else {
        throw new Error(result.data.sub_msg || '退款失败');
      }
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
      // 验证支付宝回调签名
      const isValid = this.alipaySdk.checkNotifySignV2(data);

      if (!isValid) {
        throw new Error('支付宝回调签名验证失败');
      }

      return Promise.resolve({
        provider: PaymentProvider.ALIPAY,
        event: 'payment_success',
        paymentId: data.out_trade_no,
        orderId: data.out_trade_no,
        status: this.mapAlipayStatus(data.trade_status),
        amount: parseFloat(data.total_amount),
        paidAt: data.notify_time ? new Date(data.notify_time) : new Date(),
        rawData: data,
        signature,
      });
    } catch (error) {
      throw new Error(`支付宝回调验证失败: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    // 支付宝不需要特殊的关闭操作
  }

  private createWebPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const bizContent = {
      out_trade_no: thirdPartyOrderId,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: request.amount.toString(),
      subject: request.subject,
      body: request.body,
    };

    // 生成支付表单HTML
    const formHtml = this.alipaySdk.pageExecute(
      'alipay.trade.page.pay',
      'POST',
      {
        bizContent,
        returnUrl: request.returnUrl || this.config.returnUrl,
      },
    );

    // 生成支付链接
    const paymentUrl = this.alipaySdk.pageExecute(
      'alipay.trade.page.pay',
      'GET',
      {
        bizContent,
        returnUrl: request.returnUrl || this.config.returnUrl,
      },
    );

    return Promise.resolve({
      paymentForm: formHtml,
      paymentUrl,
    });
  }

  private createWapPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const bizContent = {
      out_trade_no: thirdPartyOrderId,
      product_code: 'QUICK_WAP_WAY',
      total_amount: request.amount.toString(),
      subject: request.subject,
      body: request.body,
    };

    const paymentUrl = this.alipaySdk.pageExecute(
      'alipay.trade.wap.pay',
      'GET',
      {
        bizContent,
        returnUrl: request.returnUrl || this.config.returnUrl,
      },
    );

    const paymentForm = this.alipaySdk.pageExecute(
      'alipay.trade.wap.pay',
      'POST',
      {
        bizContent,
        returnUrl: request.returnUrl || this.config.returnUrl,
      },
    );

    return Promise.resolve({
      paymentUrl,
      paymentForm,
    });
  }

  private createAppPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const bizContent = {
      out_trade_no: thirdPartyOrderId,
      product_code: 'QUICK_MSECURITY_PAY',
      total_amount: request.amount.toString(),
      subject: request.subject,
      body: request.body,
    };

    // APP支付返回订单字符串
    const orderString = this.alipaySdk.sdkExecute('alipay.trade.app.pay', {
      bizContent,
    });

    return Promise.resolve({
      orderString,
    });
  }

  private async createQRPay(
    request: CreatePaymentRequest,
    thirdPartyOrderId: string,
  ): Promise<any> {
    const result = await this.alipaySdk.curl(
      'POST',
      '/v3/alipay/trade/precreate',
      {
        body: {
          out_trade_no: thirdPartyOrderId,
          total_amount: request.amount.toString(),
          subject: request.subject,
          body: request.body,
        },
      },
    );

    if (result.responseHttpStatus === 200 && result.data.code === '10000') {
      return {
        qrCode: result.data.qr_code,
      };
    } else {
      throw new Error(result.data.sub_msg || '支付宝扫码支付创建失败');
    }
  }

  private mapAlipayStatus(status: string): PaymentStatus {
    switch (status) {
      case 'TRADE_SUCCESS':
        return PaymentStatus.SUCCESS;
      case 'TRADE_FINISHED':
        return PaymentStatus.SUCCESS;
      case 'TRADE_CLOSED':
        return PaymentStatus.CANCELLED;
      case 'WAIT_BUYER_PAY':
        return PaymentStatus.PENDING;
      default:
        return PaymentStatus.FAILED;
    }
  }
}
