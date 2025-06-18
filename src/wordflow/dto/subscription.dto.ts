import {
  ObjectType,
  Field,
  registerEnumType,
  InputType,
} from '@nestjs/graphql';
import { SubscriptionStatus, SubscriptionPlan } from '../../types/subscription';
import {
  PaymentProvider,
  PaymentMethod,
  PaymentStatus,
} from '../../payments/types';
import { PromoteCodeType } from '../../config/promoteCode';

// Register enums for GraphQL
registerEnumType(SubscriptionStatus, {
  name: 'SubscriptionStatus',
});

registerEnumType(SubscriptionPlan, {
  name: 'SubscriptionPlan',
});

registerEnumType(PaymentProvider, {
  name: 'PaymentProvider',
});

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
});

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
});

registerEnumType(PromoteCodeType, {
  name: 'PromoteCodeType',
});

@ObjectType()
export class UserSubscriptionDto {
  @Field()
  id: string;

  @Field()
  user_id: string;

  @Field(() => SubscriptionPlan)
  plan: SubscriptionPlan;

  @Field(() => SubscriptionStatus)
  status: SubscriptionStatus;

  @Field()
  start_date: Date;

  @Field()
  end_date: Date;

  @Field()
  months_count: number;

  @Field()
  price_per_month: number;

  @Field()
  total_price: number;

  @Field({ nullable: true })
  payment_id?: string;

  @Field({ nullable: true })
  promote_code?: string;

  @Field({ nullable: true })
  promote_discount?: number;

  @Field({ nullable: true })
  free_months?: number;

  @Field({ nullable: true })
  original_price?: number;

  @Field()
  created_at: Date;

  @Field()
  updated_at: Date;
}

@ObjectType()
export class SubscriptionPricingDto {
  @Field()
  monthly_price: number;

  @Field()
  quarterly_discount: number;

  @Field()
  yearly_discount: number;
}

@ObjectType()
export class SubscriptionPriceCalculationDto {
  @Field()
  totalPrice: number;

  @Field()
  pricePerMonth: number;

  @Field()
  discount: number;
}

@ObjectType()
export class RefundResponseDto {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class PaymentMethodDto {
  @Field()
  provider: string;

  @Field(() => [String])
  methods: string[];
}

@ObjectType()
export class BatchReminderResultDto {
  @Field()
  sent: number;

  @Field()
  failed: number;

  @Field(() => [UserSubscriptionDto])
  upcomingExpiry: UserSubscriptionDto[];

  @Field(() => [String])
  errors: string[];
}

@ObjectType()
export class ExpiredSubscriptionResultDto {
  @Field()
  expired: number;

  @Field()
  notified: number;

  @Field(() => [String])
  errors: string[];
}

@ObjectType()
export class SubscriptionRevenueDto {
  @Field()
  total: number;

  @Field()
  thisMonth: number;

  @Field()
  lastMonth: number;
}

@ObjectType()
export class SubscriptionStatsDto {
  @Field()
  total: number;

  @Field()
  active: number;

  @Field()
  pending: number;

  @Field()
  expired: number;

  @Field()
  cancelled: number;

  @Field()
  upcomingExpiry: number;

  @Field(() => SubscriptionRevenueDto)
  revenue: SubscriptionRevenueDto;
}

@ObjectType()
export class EmergencyReminderResultDto {
  @Field()
  sent: number;

  @Field()
  failed: number;

  @Field(() => [String])
  errors: string[];
}

@ObjectType()
export class SubscriptionHealthCheckStatsDto {
  @Field()
  totalSubscriptions: number;

  @Field()
  activeRate: number;

  @Field()
  upcomingExpiryRate: number;

  @Field(() => SubscriptionRevenueDto)
  revenue: SubscriptionRevenueDto;
}

@ObjectType()
export class SubscriptionHealthCheckDto {
  @Field()
  status: string;

  @Field()
  message: string;

  @Field(() => SubscriptionHealthCheckStatsDto, { nullable: true })
  stats: SubscriptionHealthCheckStatsDto | null;
}

@ObjectType()
export class PaymentResponseDto {
  @Field()
  success: boolean;

  @Field()
  paymentId: string;

  @Field()
  orderId: string;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field(() => PaymentProvider)
  provider: PaymentProvider;

  @Field(() => PaymentMethod)
  method: PaymentMethod;

  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field({ nullable: true })
  payData?: string; // JSON string for complex data

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  thirdPartyOrderId?: string;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  expireTime?: Date;
}

@ObjectType()
export class PromoteCodeDto {
  @Field()
  code: string;

  @Field(() => PromoteCodeType)
  type: PromoteCodeType;

  @Field()
  value: number;

  @Field()
  description: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  usageLimit?: number;

  @Field()
  usedCount: number;

  @Field({ nullable: true })
  expiryDate?: Date;

  @Field({ nullable: true })
  minPurchaseAmount?: number;

  @Field(() => [String], { nullable: true })
  applicablePlans?: string[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class PromoteCodeApplicationDto {
  @Field()
  originalPrice: number;

  @Field()
  discountAmount: number;

  @Field()
  finalPrice: number;

  @Field({ nullable: true })
  freeMonths?: number;
}

@ObjectType()
export class PromoteCodeValidationDto {
  @Field()
  isValid: boolean;

  @Field()
  message: string;

  @Field(() => PromoteCodeApplicationDto, { nullable: true })
  application?: PromoteCodeApplicationDto;

  @Field(() => PromoteCodeDto, { nullable: true })
  promoteCode?: PromoteCodeDto;
}

@ObjectType()
export class SubscriptionPriceWithPromoteCodeDto {
  @Field()
  totalPrice: number;

  @Field()
  pricePerMonth: number;

  @Field()
  discount: number;

  @Field({ nullable: true })
  promoteCodeDiscount?: number;

  @Field({ nullable: true })
  freeMonths?: number;

  @Field()
  finalPrice: number;
}

@InputType()
export class CreateSubscriptionWithPaymentDto {
  @Field()
  monthsCount: number;

  @Field(() => PaymentProvider)
  paymentProvider: PaymentProvider;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @Field({ nullable: true })
  promoteCode?: string;
}

@InputType()
export class CreateSubscriptionPaymentDto {
  @Field()
  subscriptionId: string;

  @Field(() => PaymentProvider)
  paymentProvider: PaymentProvider;

  @Field(() => PaymentMethod)
  paymentMethod: PaymentMethod;
}

@InputType()
export class CreateSubscriptionDto {
  @Field()
  monthsCount: number;

  @Field({ nullable: true })
  promoteCode?: string;
}
