import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { UnitPayService } from '../unitPay.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly unitPayService: UnitPayService) {}

  /**
   * 微信支付回调
   */
  @Post('webhook/wechat')
  @HttpCode(200)
  async wechatWebhook(
    @Body() body: any,
    @Headers('x-wechat-signature') signature?: string,
  ): Promise<{ code: string; message: string }> {
    return this.unitPayService.wechatWebhook(body, signature);
  }

  /**
   * 支付宝支付回调
   */
  @Post('webhook/alipay')
  @HttpCode(200)
  async alipayWebhook(
    @Body() body: any,
    @Headers('x-alipay-signature') signature?: string,
  ): Promise<string> {
    return this.unitPayService.alipayWebhook(body, signature);
  }

  /**
   * 通用支付状态查询接口
   */
  @Post('query')
  async queryPayment(@Body() body: { paymentId: string }): Promise<any> {
    try {
      const result = await this.unitPayService.queryPayment(body.paymentId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('查询支付状态失败:', error);

      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Mock支付成功 - 仅用于测试环境
   */
  @Post('mock/success')
  mockPaymentSuccess(@Body() body: { orderId: string }): any {
    try {
      const result = this.unitPayService.mockPaymentSuccess(body.orderId);
      return {
        success: true,
        data: result,
        message: 'Mock支付成功操作完成',
      };
    } catch (error) {
      this.logger.error('Mock支付成功失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Mock支付失败 - 仅用于测试环境
   */
  @Post('mock/failure')
  mockPaymentFailure(@Body() body: { orderId: string; reason?: string }): any {
    try {
      const result = this.unitPayService.mockPaymentFailure(
        body.orderId,
        body.reason,
      );
      return {
        success: true,
        data: result,
        message: 'Mock支付失败操作完成',
      };
    } catch (error) {
      this.logger.error('Mock支付失败失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取Mock支付记录 - 仅用于测试环境
   */
  @Post('mock/records')
  getMockPaymentRecords(): any {
    try {
      const result = this.unitPayService.getMockPaymentRecords();
      return {
        success: true,
        data: result,
        message: '获取Mock支付记录成功',
      };
    } catch (error) {
      this.logger.error('获取Mock支付记录失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
