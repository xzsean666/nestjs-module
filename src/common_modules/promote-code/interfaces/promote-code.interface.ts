export enum PromoteCodeType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_MONTHS = 'FREE_MONTHS',
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export interface PromoteCode {
  code: string;
  type: PromoteCodeType;
  value: number;
  description?: string;
  expiryDate?: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  applicablePlans?: SubscriptionPlan[];
  minPurchaseAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromoteCodeApplication {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  freeMonths?: number;
}

export interface PromoteCodeValidationResult {
  isValid: boolean;
  message: string;
  application?: PromoteCodeApplication;
  promoteCode?: PromoteCode;
}
