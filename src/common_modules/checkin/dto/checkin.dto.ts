import { ObjectType, Field, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class CheckinStats {
  @Field(() => Int)
  totalCheckins: number;

  @Field(() => String, { nullable: true })
  lastCheckin: string | null;

  @Field(() => Int)
  streak: number;

  @Field(() => GraphQLJSON)
  monthlyStats: Record<string, number>;
}

@ObjectType()
export class MonthlyCheckin {
  @Field()
  yearMonth: string;

  @Field(() => [Int])
  checkedInDays: number[];

  @Field(() => GraphQLJSON)
  details: Record<string, any>;
}

@ObjectType()
export class WeeklyCheckin {
  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field(() => [Int])
  checkedInDays: number[];

  @Field(() => GraphQLJSON)
  details: Record<string, any>;
}
