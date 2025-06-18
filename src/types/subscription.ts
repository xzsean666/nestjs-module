export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  start_date: Date;
  end_date: Date;
  months_count: number;
  price_per_month: number;
  total_price: number;
  payment_id?: string; // TODO: 支付相关ID
  promote_code?: string; // 使用的优惠码
  promote_discount?: number; // 优惠金额
  free_months?: number; // 赠送月数
  original_price?: number; // 原价（未使用优惠码前的价格）
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionRequest {
  user_id: string;
  months_count: number;
  plan?: SubscriptionPlan; // 可选，系统会自动根据months_count确定最优plan
  promote_code?: string; // 可选的优惠码
}

export interface CreateSubscriptionWithPaymentRequest {
  user_id: string;
  months_count: number;
  plan?: SubscriptionPlan; // 可选，系统会自动根据months_count确定最优plan
  paymentProvider: string; // PaymentProvider type from payments module
  paymentMethod: string; // PaymentMethod type from payments module
  promote_code?: string; // 可选的优惠码
}

export interface SubscriptionPricing {
  monthly_price: number;
  quarterly_discount: number; // 季度折扣百分比
  yearly_discount: number; // 年度折扣百分比
}
