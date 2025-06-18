import {
  ObjectType,
  Field,
  Float,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import { SubscriptionStatus } from '../interfaces/subscription.interface';
import { SubscriptionPlan } from '../../promote-code/interfaces/promote-code.interface';

registerEnumType(SubscriptionStatus, {
  name: 'SubscriptionStatus',
  description: 'The status of subscription',
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

  @Field(() => Int)
  months_count: number;

  @Field(() => Float)
  price_per_month: number;

  @Field(() => Float)
  total_price: number;

  @Field({ nullable: true })
  payment_id?: string;

  @Field({ nullable: true })
  promote_code?: string;

  @Field(() => Float, { nullable: true })
  promote_discount?: number;

  @Field(() => Int, { nullable: true })
  free_months?: number;

  @Field(() => Float, { nullable: true })
  original_price?: number;

  @Field()
  created_at: Date;

  @Field()
  updated_at: Date;
}

@ObjectType()
export class SubscriptionPricingDto {
  @Field(() => Float)
  monthly_price: number;

  @Field(() => Float)
  quarterly_discount: number;

  @Field(() => Float)
  yearly_discount: number;
}

@ObjectType()
export class SubscriptionStatsDto {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  expired: number;

  @Field(() => Int)
  cancelled: number;

  @Field(() => Int)
  upcomingExpiry: number;

  @Field(() => SubscriptionRevenueDto)
  revenue: SubscriptionRevenueDto;
}

@ObjectType()
export class SubscriptionRevenueDto {
  @Field(() => Float)
  total: number;

  @Field(() => Float)
  thisMonth: number;

  @Field(() => Float)
  lastMonth: number;
}

@ObjectType()
export class SubscriptionReminderResultDto {
  @Field(() => Int)
  sent: number;

  @Field(() => Int)
  failed: number;

  @Field(() => [UserSubscriptionDto])
  upcomingExpiry: UserSubscriptionDto[];

  @Field(() => [String])
  errors: string[];
}
