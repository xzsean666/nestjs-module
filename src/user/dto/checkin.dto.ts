import { Field, ObjectType, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

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

  @Field(() => GraphQLJSON, { description: 'JSON of checkin details' })
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

  @Field(() => GraphQLJSON, { description: 'JSON of monthly stats' })
  monthlyStats: JSON;
}

@ObjectType()
export class WeeklyCheckin {
  @Field()
  startDate: string;
  @Field()
  endDate: string;

  @Field(() => [Int])
  checkedInDays: number[];

  @Field(() => GraphQLJSON, { description: 'JSON of checkin details' })
  details: JSON;
}
