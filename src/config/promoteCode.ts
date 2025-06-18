export enum PromoteCodeType {
  PERCENTAGE = 'percentage', // 百分比折扣
  FIXED_AMOUNT = 'fixed_amount', // 固定金额减免
  FREE_MONTHS = 'free_months', // 免费月数
}

export interface PromoteCode {
  code: string; // 优惠码
  type: PromoteCodeType; // 优惠类型
  value: number; // 优惠值
  description: string; // 描述
  isActive: boolean; // 是否激活
  usageLimit?: number; // 使用次数限制
  usedCount: number; // 已使用次数
  expiryDate?: Date; // 过期时间
  minPurchaseAmount?: number; // 最小购买金额要求
  applicablePlans?: string[]; // 适用的订阅计划，空表示适用于所有
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

export interface PromoteCodeApplication {
  originalPrice: number; // 原价
  discountAmount: number; // 折扣金额
  finalPrice: number; // 最终价格
  freeMonths?: number; // 赠送月数
}

// 预设优惠码配置
export const defaultPromoteCodes: PromoteCode[] = [
  {
    code: 'WELCOME10',
    type: PromoteCodeType.PERCENTAGE,
    value: 10, // 10% 折扣
    description: '新用户欢迎优惠 - 10% 折扣',
    isActive: true,
    usageLimit: 1000,
    usedCount: 0,
    expiryDate: new Date('2024-12-31'),
    minPurchaseAmount: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    code: 'SAVE20',
    type: PromoteCodeType.PERCENTAGE,
    value: 20, // 20% 折扣
    description: '限时特惠 - 20% 折扣',
    isActive: true,
    usageLimit: 500,
    usedCount: 0,
    expiryDate: new Date('2024-06-30'),
    minPurchaseAmount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    code: 'FREEMONTH',
    type: PromoteCodeType.FREE_MONTHS,
    value: 1, // 赠送1个月
    description: '免费赠送1个月订阅',
    isActive: true,
    usageLimit: 100,
    usedCount: 0,
    expiryDate: new Date('2024-08-31'),
    minPurchaseAmount: 90, // 需要购买至少3个月
    applicablePlans: ['quarterly', 'yearly', 'custom'], // 不适用于月度计划
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    code: 'STUDENT50',
    type: PromoteCodeType.PERCENTAGE,
    value: 50, // 50% 学生折扣
    description: '学生专属 - 50% 折扣',
    isActive: true,
    usageLimit: 200,
    usedCount: 0,
    expiryDate: new Date('2024-09-30'),
    minPurchaseAmount: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    code: 'MINUS15',
    type: PromoteCodeType.FIXED_AMOUNT,
    value: 15, // 减15元
    description: '固定减免 - 立减15元',
    isActive: true,
    usageLimit: 300,
    usedCount: 0,
    expiryDate: new Date('2024-07-31'),
    minPurchaseAmount: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
