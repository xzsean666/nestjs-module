import { SubscriptionPlan } from '../../promote-code/interfaces/promote-code.interface';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
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
  payment_id?: string;
  promote_code?: string;
  promote_discount?: number;
  free_months?: number;
  original_price?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionRequest {
  user_id: string;
  months_count: number;
  plan?: SubscriptionPlan;
  promote_code?: string;
}

export interface SubscriptionPricing {
  monthly_price: number;
  quarterly_discount: number;
  yearly_discount: number;
}

export interface SubscriptionStats {
  total: number;
  active: number;
  pending: number;
  expired: number;
  cancelled: number;
  upcomingExpiry: number;
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
  };
}

export interface SubscriptionReminderResult {
  sent: number;
  failed: number;
  upcomingExpiry: UserSubscription[];
  errors: string[];
}

export interface ExpiredSubscriptionResult {
  expired: number;
  notified: number;
  errors: string[];
}

// 支付相关接口（简化版本，实际使用时需要从支付模块导入）
export interface PaymentRequest {
  user_id: string;
  subscription_id: string;
  amount: number;
  provider: string;
  method: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  message?: string;
  paymentUrl?: string;
}
