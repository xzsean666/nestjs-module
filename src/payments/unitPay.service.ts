import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentConfig,
  PaymentProviderInterface,
  CreatePaymentRequest,
  PaymentResponse,
  QueryPaymentRequest,
  QueryPaymentResponse,
  RefundRequest,
  RefundResponse,
  WebhookData,
  PaymentRecord,
  PaymentStatus,
  PaymentMethod,
} from './types';
import { WechatPayProvider } from './providers/wechat.provider';
import { AlipayProvider } from './providers/alipay.provider';
import { MockPayProvider } from './providers/mock.provider';
import { v4 as uuidv4 } from 'uuid';
import { DBService, PGKVDatabase, db_tables } from 'src/common/db.service';

@Injectable()
export class UnitPayService {
  private readonly logger = new Logger(UnitPayService.name);
  private providers: Map<PaymentProvider, PaymentProviderInterface> = new Map();
  private paymentRecords: PGKVDatabase;
  private userPayment: PGKVDatabase;

  constructor(
    private readonly dbService: DBService,
    @Inject('SUBSCRIPTION_SERVICE') private readonly subscriptionService?: any,
  ) {
    this.paymentRecords = this.dbService.getDBInstance(
      db_tables.payment_records,
    );
    this.userPayment = this.dbService.getDBInstance(db_tables.user_payment);

    // 自动初始化Mock支付提供商
    this.initializeMockProvider();
  }

  /**
   * 自动初始化Mock支付提供商
   */
  private initializeMockProvider(): void {
    try {
      const mockConfig: PaymentConfig = {
        provider: PaymentProvider.MOCK,
        sandbox: true,
        notifyUrl: 'http://localhost:3000/payment/webhook/mock',
        returnUrl: 'http://localhost:3000/payment/return',
      };

      const mockProvider = new MockPayProvider(mockConfig);
      this.providers.set(PaymentProvider.MOCK, mockProvider);
      this.logger.log('Mock支付提供商自动初始化成功');
    } catch (error) {
      this.logger.error('Mock支付提供商初始化失败:', error);
    }
  }

  /**
   * 初始化支付提供商
   */
  initialize(configs: PaymentConfig[]): void {
    for (const config of configs) {
      try {
        let provider: PaymentProviderInterface;

        switch (config.provider) {
          case PaymentProvider.WECHAT:
            provider = new WechatPayProvider(config);
            break;
          case PaymentProvider.ALIPAY:
            provider = new AlipayProvider(config);
            break;
          case PaymentProvider.MOCK:
            provider = new MockPayProvider(config);
            break;
          default:
            this.logger.warn(`不支持的支付提供商: ${config.provider}`);
            continue;
        }

        this.providers.set(config.provider, provider);
        this.logger.log(`${config.provider} 支付提供商初始化成功`);
      } catch (error) {
        this.logger.error(`${config.provider} 支付提供商初始化失败:`, error);
      }
    }
  }

  /**
   * 创建支付订单
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    try {
      const provider = this.getProvider(request.provider);

      // 生成支付记录ID
      const paymentId = uuidv4();

      // 调用具体支付提供商创建支付
      const response = await provider.createPayment({
        ...request,
        orderId: request.orderId || paymentId,
      });

      // 保存支付记录到数据库
      const paymentRecord: PaymentRecord = {
        id: paymentId,
        orderId: response.orderId,
        userId: request.userId,
        amount: request.amount,
        currency: request.currency,
        provider: request.provider,
        method: request.method,
        status: response.status,
        subject: request.subject,
        body: request.body,
        thirdPartyOrderId: response.thirdPartyOrderId,
        payData:
          typeof response.payData === 'string'
            ? response.payData
            : JSON.stringify(response.payData || {}),
        metadata: request.metadata,
        createdAt: new Date(),
        expireTime: request.expireTime,
        updatedAt: new Date(),
      };
      if (!request.userId) throw new Error('用户ID不能为空');
      await this.userPayment.saveArray(request.userId, [paymentId]);
      await this.paymentRecords.put(paymentId, paymentRecord);

      this.logger.log(
        `支付订单创建成功: ${paymentId}, 提供商: ${request.provider}`,
      );

      return {
        ...response,
        paymentId,
      };
    } catch (error) {
      this.logger.error(`创建支付订单失败:`, error);
      throw new Error(`创建支付订单失败: ${error.message}`);
    }
  }

  /**
   * 查询支付状态
   */
  async queryPayment(paymentId: string): Promise<QueryPaymentResponse> {
    try {
      const paymentRecord = await this.paymentRecords.get(paymentId);
      if (!paymentRecord) {
        throw new Error('支付记录不存在');
      }

      const provider = this.getProvider(paymentRecord.provider);

      const response = await provider.queryPayment({
        paymentId,
        orderId: paymentRecord.orderId,
        thirdPartyOrderId: paymentRecord.thirdPartyOrderId,
      });

      // 如果状态发生变化，更新本地记录
      if (response.status !== paymentRecord.status) {
        const updatedRecord: PaymentRecord = {
          ...paymentRecord,
          status: response.status,
          paidAt: response.paidAt,
          failureReason: response.failureReason,
          updatedAt: new Date(),
        };

        await this.paymentRecords.put(paymentId, updatedRecord);

        this.logger.log(
          `支付状态更新: ${paymentId}, ${paymentRecord.status} -> ${response.status}`,
        );

        // 如果状态变为成功，处理支付成功逻辑
        if (
          response.status === PaymentStatus.SUCCESS &&
          this.subscriptionService?.handlePaymentSuccess
        ) {
          try {
            await this.subscriptionService.handlePaymentSuccess(paymentId);
            this.logger.log(`查询支付成功后处理订阅服务: ${paymentId}`);
          } catch (error) {
            this.logger.warn('订阅服务处理支付成功失败:', error);
          }
        }
      }

      return response;
    } catch (error) {
      this.logger.error(`查询支付状态失败:`, error);
      throw new Error(`查询支付状态失败: ${error.message}`);
    }
  }

  /**
   * 申请退款
   */
  async refundPayment(
    paymentId: string,
    refundAmount?: number,
    reason?: string,
  ): Promise<RefundResponse> {
    try {
      const paymentRecord = await this.paymentRecords.get(paymentId);
      if (!paymentRecord) {
        throw new Error('支付记录不存在');
      }

      if (paymentRecord.status !== PaymentStatus.SUCCESS) {
        throw new Error('只有支付成功的订单才能申请退款');
      }

      const provider = this.getProvider(paymentRecord.provider);

      const response = await provider.refundPayment({
        paymentId,
        refundAmount: refundAmount || paymentRecord.amount,
        reason: reason || '用户申请退款',
      });

      // 更新支付记录状态
      if (response.success) {
        const updatedRecord: PaymentRecord = {
          ...paymentRecord,
          status: response.status,
          updatedAt: new Date(),
        };

        await this.paymentRecords.put(paymentId, updatedRecord);

        this.logger.log(
          `退款申请成功: ${paymentId}, 金额: ${response.refundAmount}`,
        );
      }

      return response;
    } catch (error) {
      this.logger.error(`申请退款失败:`, error);
      throw new Error(`申请退款失败: ${error.message}`);
    }
  }

  /**
   * 通过订单ID查找支付记录 (优化版本)
   */
  private async findPaymentRecordByOrderId(
    orderId: string,
  ): Promise<{ id: string; record: PaymentRecord } | null> {
    // 首先尝试直接通过 paymentId 获取
    const directRecord = await this.paymentRecords.get(orderId);
    if (directRecord) {
      return { id: orderId, record: directRecord };
    }

    // 如果直接查找失败，遍历所有记录查找匹配的 orderId 或 thirdPartyOrderId
    // 注意：这里仍然需要获取所有记录，但这是备用方案
    // 在实际生产环境中，建议为 orderId 和 thirdPartyOrderId 建立索引
    const allRecords = await this.paymentRecords.getAll();
    for (const [id, record] of Object.entries(allRecords)) {
      if (record.orderId === orderId || record.thirdPartyOrderId === orderId) {
        return { id, record };
      }
    }

    return null;
  }

  /**
   * 处理支付回调
   */
  async handleWebhook(
    provider: PaymentProvider,
    data: any,
    signature?: string,
  ): Promise<{ success: boolean; paymentId?: string; message?: string }> {
    try {
      const providerInstance = this.getProvider(provider);

      const webhookData = await providerInstance.verifyWebhook(data, signature);

      if (!webhookData.paymentId && !webhookData.orderId) {
        throw new Error('回调数据中缺少支付ID或订单ID');
      }

      // 根据订单ID查找支付记录
      const paymentId = webhookData.paymentId || webhookData.orderId!;
      const paymentResult = await this.findPaymentRecordByOrderId(paymentId);

      if (!paymentResult) {
        throw new Error('找不到对应的支付记录');
      }

      const { id: recordId, record: paymentRecord } = paymentResult;

      // 更新支付状态
      const updatedRecord: PaymentRecord = {
        ...paymentRecord,
        status: webhookData.status!,
        paidAt: webhookData.paidAt,
        updatedAt: new Date(),
      };

      await this.paymentRecords.put(recordId, updatedRecord);

      this.logger.log(
        `支付回调处理成功: ${recordId}, 状态: ${webhookData.status}`,
      );

      // 如果支付成功，处理支付成功逻辑
      if (
        webhookData.status === PaymentStatus.SUCCESS &&
        this.subscriptionService?.handlePaymentSuccess
      ) {
        try {
          await this.subscriptionService.handlePaymentSuccess(recordId);
          this.logger.log(`Webhook支付成功后处理订阅服务: ${recordId}`);
        } catch (error) {
          this.logger.warn('订阅服务处理支付成功失败:', error);
        }
      }

      return {
        success: true,
        paymentId: recordId,
        message: '回调处理成功',
      };
    } catch (error) {
      this.logger.error(`处理支付回调失败:`, error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 微信支付回调处理
   */
  async wechatWebhook(
    body: any,
    signature?: string,
  ): Promise<{ code: string; message: string }> {
    try {
      this.logger.log('收到微信支付回调');

      const result = await this.handleWebhook(
        PaymentProvider.WECHAT,
        body,
        signature,
      );

      if (result.success) {
        this.logger.log(`微信支付回调处理成功: ${result.paymentId}`);
        return {
          code: 'SUCCESS',
          message: 'OK',
        };
      } else {
        this.logger.error(`微信支付回调处理失败: ${result.message}`);
        return {
          code: 'FAIL',
          message: result.message || '处理失败',
        };
      }
    } catch (error) {
      this.logger.error('微信支付回调异常:', error);
      return {
        code: 'FAIL',
        message: '系统异常',
      };
    }
  }

  /**
   * 支付宝支付回调处理
   */
  async alipayWebhook(body: any, signature?: string): Promise<string> {
    try {
      this.logger.log('收到支付宝支付回调');

      const result = await this.handleWebhook(
        PaymentProvider.ALIPAY,
        body,
        signature,
      );

      if (result.success) {
        this.logger.log(`支付宝支付回调处理成功: ${result.paymentId}`);
        return 'success';
      } else {
        this.logger.error(`支付宝支付回调处理失败: ${result.message}`);
        return 'fail';
      }
    } catch (error) {
      this.logger.error('支付宝支付回调异常:', error);
      return 'fail';
    }
  }

  /**
   * 获取支付记录
   */
  async getPaymentRecord(paymentId: string): Promise<PaymentRecord | null> {
    return this.paymentRecords.get(paymentId);
  }

  /**
   * 批量获取支付记录
   */
  private async batchGetPaymentRecords(
    paymentIds: string[],
  ): Promise<PaymentRecord[]> {
    if (!paymentIds || paymentIds.length === 0) {
      return [];
    }

    // 使用 PGKVDatabase 的 getMany 方法进行真正的批量查询
    const results = await this.paymentRecords.getMany(paymentIds);

    // 转换结果格式并过滤有效记录
    return results
      .map((result) => result.value)
      .filter(Boolean) as PaymentRecord[];
  }

  /**
   * 获取用户的支付记录列表
   */
  async getUserPaymentHistory(userId: string): Promise<PaymentRecord[]> {
    // 使用 userPayment 数据库直接获取用户的 paymentId 列表
    const userPaymentIds = await this.userPayment.getAllArray(userId);
    if (!userPaymentIds || userPaymentIds.length === 0) {
      return [];
    }

    // 批量获取支付记录
    const paymentRecords = await this.batchGetPaymentRecords(userPaymentIds);

    return paymentRecords.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * 获取用户最近的支付记录（分页支持）
   */
  async getUserRecentPayments(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    records: PaymentRecord[];
    total: number;
    hasMore: boolean;
  }> {
    // 使用 userPayment 数据库的 getRecentArray 方法获取最近的支付记录
    const totalPaymentIds = await this.userPayment.getAllArray(userId);
    const total = totalPaymentIds.length;

    if (total === 0) {
      return {
        records: [],
        total: 0,
        hasMore: false,
      };
    }

    // 获取指定范围的支付ID（从最新开始）
    const recentPaymentIds = await this.userPayment.getRecentArray(
      userId,
      limit,
      offset,
    );

    // 批量获取支付记录
    const paymentRecords = await this.batchGetPaymentRecords(recentPaymentIds);

    // 按创建时间排序（最新的在前）
    const sortedRecords = paymentRecords.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      records: sortedRecords,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * 获取支付统计信息
   */
  async getPaymentStats(userId?: string): Promise<{
    total: number;
    success: number;
    pending: number;
    failed: number;
    refunded: number;
    totalAmount: number;
    successAmount: number;
    refundedAmount: number;
  }> {
    let records: PaymentRecord[];

    if (userId) {
      // 使用 userPayment 数据库直接获取用户的支付记录
      const userPaymentIds = await this.userPayment.getAllArray(userId);
      records = await this.batchGetPaymentRecords(userPaymentIds);
    } else {
      // 获取所有记录
      const allRecords = await this.paymentRecords.getAll();
      records = Object.values(allRecords);
    }

    const stats = {
      total: records.length,
      success: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      totalAmount: 0,
      successAmount: 0,
      refundedAmount: 0,
    };

    for (const record of records) {
      stats.totalAmount += record.amount;

      switch (record.status) {
        case PaymentStatus.SUCCESS:
          stats.success++;
          stats.successAmount += record.amount;
          break;
        case PaymentStatus.PENDING:
          stats.pending++;
          break;
        case PaymentStatus.FAILED:
        case PaymentStatus.CANCELLED:
          stats.failed++;
          break;
        case PaymentStatus.REFUNDED:
        case PaymentStatus.PARTIAL_REFUNDED:
          stats.refunded++;
          stats.refundedAmount += record.amount;
          break;
      }
    }

    return stats;
  }

  /**
   * 检查支付方式是否可用
   */
  isPaymentMethodAvailable(
    provider: PaymentProvider,
    method: PaymentMethod,
  ): boolean {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      return false;
    }

    // 根据支付方式检查提供商是否支持
    switch (provider) {
      case PaymentProvider.WECHAT:
        return [
          PaymentMethod.WECHAT_JSAPI,
          PaymentMethod.WECHAT_NATIVE,
          PaymentMethod.WECHAT_APP,
          PaymentMethod.WECHAT_H5,
        ].includes(method);
      case PaymentProvider.ALIPAY:
        return [
          PaymentMethod.ALIPAY_WEB,
          PaymentMethod.ALIPAY_WAP,
          PaymentMethod.ALIPAY_APP,
          PaymentMethod.ALIPAY_QR,
        ].includes(method);
      case PaymentProvider.MOCK:
        return [
          PaymentMethod.MOCK_QR,
          PaymentMethod.MOCK_WEB,
          PaymentMethod.MOCK_H5,
        ].includes(method);
      default:
        return false;
    }
  }

  /**
   * 获取可用的支付方式列表
   */
  getAvailablePaymentMethods(): Array<{
    provider: PaymentProvider;
    methods: PaymentMethod[];
  }> {
    const availableMethods: Array<{
      provider: PaymentProvider;
      methods: PaymentMethod[];
    }> = [];

    for (const [provider] of this.providers) {
      let methods: PaymentMethod[] = [];

      switch (provider) {
        case PaymentProvider.WECHAT:
          methods = [
            PaymentMethod.WECHAT_JSAPI,
            PaymentMethod.WECHAT_NATIVE,
            PaymentMethod.WECHAT_APP,
            PaymentMethod.WECHAT_H5,
          ];
          break;
        case PaymentProvider.ALIPAY:
          methods = [
            PaymentMethod.ALIPAY_WEB,
            PaymentMethod.ALIPAY_WAP,
            PaymentMethod.ALIPAY_APP,
            PaymentMethod.ALIPAY_QR,
          ];
          break;
        case PaymentProvider.MOCK:
          methods = [
            PaymentMethod.MOCK_QR,
            PaymentMethod.MOCK_WEB,
            PaymentMethod.MOCK_H5,
          ];
          break;
      }

      if (methods.length > 0) {
        availableMethods.push({ provider, methods });
      }
    }

    return availableMethods;
  }

  /**
   * 删除支付记录并更新用户支付关系
   */
  async deletePaymentRecord(paymentId: string): Promise<boolean> {
    try {
      // 获取支付记录
      const paymentRecord = await this.paymentRecords.get(paymentId);
      if (!paymentRecord) {
        this.logger.warn(`要删除的支付记录不存在: ${paymentId}`);
        return false;
      }

      const userId = paymentRecord.userId;

      // 删除支付记录
      await this.paymentRecords.delete(paymentId);

      // 更新用户支付关系
      if (userId) {
        const userPaymentIds = await this.userPayment.getAllArray(userId);
        const updatedIds = userPaymentIds.filter((id) => id !== paymentId);

        if (updatedIds.length > 0) {
          await this.userPayment.saveArray(userId, updatedIds, {
            overwrite: true,
          });
        } else {
          // 如果用户没有其他支付记录，删除整个关系记录
          await this.userPayment.delete(userId);
        }
      }

      this.logger.log(`支付记录删除成功: ${paymentId}`);
      return true;
    } catch (error) {
      this.logger.error(`删除支付记录失败:`, error);
      throw new Error(`删除支付记录失败: ${error.message}`);
    }
  }

  /**
   * 清理用户支付关系数据，确保数据一致性
   * 删除不存在的支付记录ID，并为没有关系记录的用户支付添加关系
   */
  async cleanupUserPaymentRelations(): Promise<{
    removedRelations: number;
    addedRelations: number;
  }> {
    this.logger.log('开始清理用户支付关系数据...');

    let removedRelations = 0;
    let addedRelations = 0;

    try {
      // 获取所有支付记录
      const allPaymentRecords = await this.paymentRecords.getAll();
      const validPaymentIds = new Set(Object.keys(allPaymentRecords));

      // 获取所有用户支付关系
      const allUserPayments = await this.userPayment.getAll();

      // 清理无效的关系记录
      for (const [userId, paymentIds] of Object.entries(allUserPayments)) {
        if (Array.isArray(paymentIds)) {
          const validIds = paymentIds.filter((id) => validPaymentIds.has(id));
          if (validIds.length !== paymentIds.length) {
            await this.userPayment.saveArray(userId, validIds, {
              overwrite: true,
            });
            removedRelations += paymentIds.length - validIds.length;
          }
        }
      }

      // 添加缺失的关系记录
      const userPaymentMap = new Map<string, string[]>();

      // 构建用户ID到支付ID的映射
      for (const [userId, paymentIds] of Object.entries(allUserPayments)) {
        if (Array.isArray(paymentIds)) {
          userPaymentMap.set(userId, paymentIds);
        }
      }

      // 检查每个支付记录是否有对应的用户关系
      for (const [paymentId, record] of Object.entries(allPaymentRecords)) {
        const userId = record.userId;
        if (userId) {
          const existingPayments = userPaymentMap.get(userId) || [];
          if (!existingPayments.includes(paymentId)) {
            // 添加缺失的关系
            existingPayments.push(paymentId);
            userPaymentMap.set(userId, existingPayments);
            await this.userPayment.saveArray(userId, existingPayments, {
              overwrite: true,
            });
            addedRelations++;
          }
        }
      }

      this.logger.log(
        `用户支付关系数据清理完成: 删除 ${removedRelations} 个无效关系, 添加 ${addedRelations} 个缺失关系`,
      );

      return { removedRelations, addedRelations };
    } catch (error) {
      this.logger.error('清理用户支付关系数据失败:', error);
      throw new Error(`清理用户支付关系数据失败: ${error.message}`);
    }
  }

  /**
   * 关闭所有支付提供商连接
   */
  async close(): Promise<void> {
    for (const [provider, instance] of this.providers) {
      try {
        await instance.close();
        this.logger.log(`${provider} 支付提供商连接已关闭`);
      } catch (error) {
        this.logger.error(`关闭 ${provider} 支付提供商连接失败:`, error);
      }
    }
    this.providers.clear();
  }

  /**
   * 获取支付提供商实例
   */
  private getProvider(provider: PaymentProvider): PaymentProviderInterface {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`支付提供商 ${provider} 未初始化`);
    }
    return providerInstance;
  }

  /**
   * Mock支付成功 - 仅用于测试环境
   */
  mockPaymentSuccess(orderId: string): boolean {
    const mockProvider = this.providers.get(PaymentProvider.MOCK);
    if (!mockProvider || !(mockProvider instanceof MockPayProvider)) {
      throw new Error('Mock支付提供商未初始化');
    }

    const success = (mockProvider as any).mockPaymentSuccess(orderId);
    if (success) {
      this.logger.log(`Mock支付成功: ${orderId}`);
    }
    return success;
  }

  /**
   * Mock支付失败 - 仅用于测试环境
   */
  mockPaymentFailure(orderId: string, reason?: string): boolean {
    const mockProvider = this.providers.get(PaymentProvider.MOCK);
    if (!mockProvider || !(mockProvider instanceof MockPayProvider)) {
      throw new Error('Mock支付提供商未初始化');
    }

    const success = (mockProvider as any).mockPaymentFailure(orderId, reason);
    if (success) {
      this.logger.log(`Mock支付失败: ${orderId}, 原因: ${reason}`);
    }
    return success;
  }

  /**
   * 获取Mock支付记录 - 仅用于测试环境
   */
  getMockPaymentRecords(): Array<any> {
    const mockProvider = this.providers.get(PaymentProvider.MOCK);
    if (!mockProvider || !(mockProvider instanceof MockPayProvider)) {
      throw new Error('Mock支付提供商未初始化');
    }

    return (mockProvider as any).getMockPaymentRecords();
  }
}
