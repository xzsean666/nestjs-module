import { Injectable, BadRequestException } from '@nestjs/common';
import { DBService, PGKVDatabase, db_tables } from '../../common/db.service';
import {
  PromoteCode,
  PromoteCodeType,
  PromoteCodeApplication,
  PromoteCodeValidationResult,
  SubscriptionPlan,
} from './interfaces/promote-code.interface';

@Injectable()
export class PromoteCodeService {
  private promoteCodesDB: PGKVDatabase;

  // 默认促销码配置
  private readonly defaultPromoteCodes: PromoteCode[] = [
    {
      code: 'WELCOME10',
      type: PromoteCodeType.PERCENTAGE,
      value: 10,
      description: '新用户优惠10%',
      isActive: true,
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: 'SAVE20',
      type: PromoteCodeType.PERCENTAGE,
      value: 20,
      description: '节省20%',
      isActive: true,
      usedCount: 0,
      applicablePlans: [SubscriptionPlan.YEARLY],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: 'FLAT50',
      type: PromoteCodeType.FIXED_AMOUNT,
      value: 50,
      description: '立减50元',
      isActive: true,
      usedCount: 0,
      minPurchaseAmount: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      code: 'FREEMONTH',
      type: PromoteCodeType.FREE_MONTHS,
      value: 1,
      description: '赠送1个月',
      isActive: true,
      usedCount: 0,
      applicablePlans: [SubscriptionPlan.YEARLY, SubscriptionPlan.QUARTERLY],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  constructor(private readonly dbService: DBService) {
    this.promoteCodesDB = this.dbService.getDBInstance(db_tables.promote_codes);
    void this.initializeDefaultPromoteCodes();
  }

  /**
   * 初始化默认优惠码
   */
  private async initializeDefaultPromoteCodes(): Promise<void> {
    try {
      for (const promoteCode of this.defaultPromoteCodes) {
        const existing = await this.promoteCodesDB.get(promoteCode.code);
        if (!existing) {
          await this.promoteCodesDB.put(promoteCode.code, promoteCode);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize default promote codes:', error);
    }
  }

  /**
   * 验证优惠码并计算折扣
   */
  async validateAndApplyPromoteCode(
    promoteCodeStr: string,
    originalPrice: number,
    monthsCount: number,
    plan?: SubscriptionPlan,
  ): Promise<PromoteCodeValidationResult> {
    if (!promoteCodeStr) {
      return {
        isValid: false,
        message: '优惠码不能为空',
      };
    }

    const promoteCode = await this.promoteCodesDB.get(
      promoteCodeStr.toUpperCase(),
    );

    if (!promoteCode) {
      return {
        isValid: false,
        message: '优惠码不存在',
      };
    }

    // 检查优惠码是否激活
    if (!promoteCode.isActive) {
      return {
        isValid: false,
        message: '优惠码已失效',
      };
    }

    // 检查使用次数限制
    if (
      promoteCode.usageLimit &&
      promoteCode.usedCount >= promoteCode.usageLimit
    ) {
      return {
        isValid: false,
        message: '优惠码使用次数已达上限',
      };
    }

    // 检查是否过期
    if (
      promoteCode.expiryDate &&
      new Date() > new Date(promoteCode.expiryDate)
    ) {
      return {
        isValid: false,
        message: '优惠码已过期',
      };
    }

    // 检查最小购买金额要求
    if (
      promoteCode.minPurchaseAmount &&
      originalPrice < promoteCode.minPurchaseAmount
    ) {
      return {
        isValid: false,
        message: `最小购买金额为 ${promoteCode.minPurchaseAmount} 元`,
      };
    }

    // 如果提供了plan参数，检查适用的订阅计划
    if (
      plan &&
      promoteCode.applicablePlans &&
      promoteCode.applicablePlans.length > 0 &&
      !promoteCode.applicablePlans.includes(plan)
    ) {
      return {
        isValid: false,
        message: '该优惠码不适用于当前订阅计划',
      };
    }

    // 计算折扣
    const application = this.calculateDiscount(
      promoteCode,
      originalPrice,
      monthsCount,
    );

    return {
      isValid: true,
      message: '优惠码有效',
      application,
      promoteCode,
    };
  }

  /**
   * 计算折扣
   */
  private calculateDiscount(
    promoteCode: PromoteCode,
    originalPrice: number,
    monthsCount: number,
  ): PromoteCodeApplication {
    let discountAmount = 0;
    let freeMonths = 0;

    switch (promoteCode.type) {
      case PromoteCodeType.PERCENTAGE:
        discountAmount = originalPrice * (promoteCode.value / 100);
        break;

      case PromoteCodeType.FIXED_AMOUNT:
        discountAmount = Math.min(promoteCode.value, originalPrice);
        break;

      case PromoteCodeType.FREE_MONTHS:
        freeMonths = promoteCode.value;
        // 对于免费月数，不减少价格，而是赠送额外的月数
        discountAmount = 0;
        break;

      default:
        throw new BadRequestException('不支持的优惠码类型');
    }

    // 确保折扣金额不超过原价
    discountAmount = Math.min(discountAmount, originalPrice);
    discountAmount = Math.max(0, discountAmount);

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      originalPrice,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      freeMonths: freeMonths > 0 ? freeMonths : undefined,
    };
  }

  /**
   * 使用优惠码（增加使用次数）
   */
  async usePromoteCode(promoteCodeStr: string): Promise<void> {
    const promoteCode = await this.promoteCodesDB.get(
      promoteCodeStr.toUpperCase(),
    );
    if (promoteCode) {
      const updatedPromoteCode: PromoteCode = {
        ...promoteCode,
        usedCount: promoteCode.usedCount + 1,
        updatedAt: new Date(),
      };
      await this.promoteCodesDB.put(
        promoteCodeStr.toUpperCase(),
        updatedPromoteCode,
      );
    }
  }

  /**
   * 获取有效的优惠码列表（管理员功能）
   */
  async getActivePromoteCodes(): Promise<PromoteCode[]> {
    const allCodes = await this.promoteCodesDB.getAll();
    const activeCodes: PromoteCode[] = [];

    for (const [key, value] of Object.entries(allCodes)) {
      const promoteCode = value as PromoteCode;
      if (
        promoteCode.isActive &&
        (!promoteCode.expiryDate ||
          new Date() <= new Date(promoteCode.expiryDate))
      ) {
        activeCodes.push(promoteCode);
      }
    }

    return activeCodes.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * 创建新的优惠码（管理员功能）
   */
  async createPromoteCode(
    promoteCodeData: Omit<PromoteCode, 'usedCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<PromoteCode> {
    const codeUpper = promoteCodeData.code.toUpperCase();

    // 检查优惠码是否已存在
    const existing = await this.promoteCodesDB.get(codeUpper);
    if (existing) {
      throw new BadRequestException('优惠码已存在');
    }

    const promoteCode: PromoteCode = {
      ...promoteCodeData,
      code: codeUpper,
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.promoteCodesDB.put(codeUpper, promoteCode);
    return promoteCode;
  }

  /**
   * 更新优惠码（管理员功能）
   */
  async updatePromoteCode(
    code: string,
    updates: Partial<PromoteCode>,
  ): Promise<PromoteCode> {
    const codeUpper = code.toUpperCase();
    const existing = await this.promoteCodesDB.get(codeUpper);

    if (!existing) {
      throw new BadRequestException('优惠码不存在');
    }

    const updatedPromoteCode: PromoteCode = {
      ...existing,
      ...updates,
      code: codeUpper, // 确保code不会被修改
      updatedAt: new Date(),
    };

    await this.promoteCodesDB.put(codeUpper, updatedPromoteCode);
    return updatedPromoteCode;
  }

  /**
   * 删除优惠码（管理员功能）
   */
  async deletePromoteCode(code: string): Promise<boolean> {
    const codeUpper = code.toUpperCase();
    await this.promoteCodesDB.delete(codeUpper);
    return true;
  }

  /**
   * 获取单个优惠码信息
   */
  async getPromoteCode(code: string): Promise<PromoteCode | null> {
    return await this.promoteCodesDB.get(code.toUpperCase());
  }

  /**
   * 获取优惠码使用统计
   */
  async getPromoteCodeStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    totalUsage: number;
  }> {
    const allCodes = await this.promoteCodesDB.getAll();
    let total = 0;
    let active = 0;
    let expired = 0;
    let totalUsage = 0;

    const now = new Date();

    for (const [key, value] of Object.entries(allCodes)) {
      const promoteCode = value as PromoteCode;
      total++;
      totalUsage += promoteCode.usedCount;

      if (
        promoteCode.isActive &&
        (!promoteCode.expiryDate || now <= new Date(promoteCode.expiryDate))
      ) {
        active++;
      } else {
        expired++;
      }
    }

    return {
      total,
      active,
      expired,
      totalUsage,
    };
  }
}
