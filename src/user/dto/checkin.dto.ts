import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class CheckinDetail {
  @Field()
  timestamp: string;
}

@ObjectType()
export class MonthlyCheckin {
  @Field()
  yearMonth: string;

  @Field(() => [Int])
  checkedInDays: number[];

  @Field(() => JSON, { description: 'JSON of checkin details' })
  details: JSON;
}

@ObjectType()
export class CheckinStats {
  @Field(() => Int)
  totalCheckins: number;

  @Field({ nullable: true })
  lastCheckin: string;

  @Field(() => Int)
  streak: number;

  @Field(() => JSON, { description: 'JSON of monthly stats' })
  monthlyStats: JSON;
}
