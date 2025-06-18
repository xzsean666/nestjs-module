import {
  ObjectType,
  Field,
  Float,
  Int,
  registerEnumType,
} from '@nestjs/graphql';
import {
  PromoteCodeType,
  SubscriptionPlan,
} from '../interfaces/promote-code.interface';

registerEnumType(PromoteCodeType, {
  name: 'PromoteCodeType',
  description: 'The type of promote code',
});

registerEnumType(SubscriptionPlan, {
  name: 'SubscriptionPlan',
  description: 'The subscription plan',
});

@ObjectType()
export class PromoteCodeDto {
  @Field()
  code: string;

  @Field(() => PromoteCodeType)
  type: PromoteCodeType;

  @Field(() => Float)
  value: number;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  expiryDate?: Date;

  @Field(() => Int, { nullable: true })
  usageLimit?: number;

  @Field(() => Int)
  usedCount: number;

  @Field()
  isActive: boolean;

  @Field(() => [SubscriptionPlan], { nullable: true })
  applicablePlans?: SubscriptionPlan[];

  @Field(() => Float, { nullable: true })
  minPurchaseAmount?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class PromoteCodeApplicationDto {
  @Field(() => Float)
  originalPrice: number;

  @Field(() => Float)
  discountAmount: number;

  @Field(() => Float)
  finalPrice: number;

  @Field(() => Int, { nullable: true })
  freeMonths?: number;
}

@ObjectType()
export class PromoteCodeValidationResultDto {
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
export class PromoteCodeStatsDto {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  expired: number;

  @Field(() => Int)
  totalUsage: number;
}
