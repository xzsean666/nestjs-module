import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CardTypeCountDto {
  @Field(() => Number)
  MIXED_CHINESE: number;

  @Field(() => Number)
  ENGLISH_ONLY: number;

  @Field(() => Number)
  FILL_IN_BLANKS: number;
}

@ObjectType()
export class StudyPlanDto {
  @Field(() => Number)
  days_remaining: number;

  @Field(() => CardTypeCountDto)
  total_unknowns: CardTypeCountDto;

  @Field(() => CardTypeCountDto)
  daily_goals: CardTypeCountDto;

  @Field(() => Number)
  total_words: number;

  @Field(() => Number, { nullable: true })
  generated_at?: number;

  @Field(() => String, { nullable: true })
  plan_date?: string;

  @Field(() => Number, { nullable: true })
  completed_at?: number;

  @Field(() => String, { nullable: true })
  progress_date?: string;

  @Field(() => CardTypeCountDto, { nullable: true })
  initial_unknown_counts?: CardTypeCountDto;

  @Field(() => CardTypeCountDto, { nullable: true })
  final_unknown_counts?: CardTypeCountDto;

  @Field(() => Number, { nullable: true })
  words_learned_count?: number;

  @Field(() => Number, { nullable: true })
  study_completion_rate?: number;
}

@ObjectType()
export class StudyProgressSummaryDto {
  @Field(() => Number)
  total_words: number;

  @Field(() => Number)
  known_words: number;

  @Field(() => Number)
  unknown_words: number;

  @Field(() => Number)
  progress_percentage: number;

  @Field(() => Number)
  days_remaining: number;

  @Field(() => CardTypeCountDto)
  daily_goals: CardTypeCountDto;

  @Field(() => String)
  plan_date: string;

  @Field(() => Number)
  generated_at: number;
}

@ObjectType()
export class DailyStudyRecordDto {
  @Field(() => StudyPlanDto)
  plan: StudyPlanDto;

  @Field(() => CardTypeCountDto, { nullable: true })
  current_unknown_counts?: CardTypeCountDto;

  @Field(() => Number, { nullable: true })
  words_learned_today?: number;

  @Field(() => Boolean)
  is_today: boolean;
}

@ObjectType()
export class DailyStatDto {
  @Field(() => String)
  date: string;

  @Field(() => Number)
  words_learned: number;

  @Field(() => Number)
  completion_rate: number;

  @Field(() => Number)
  total_unknown: number;
}

@ObjectType()
export class StudyStatsSummaryDto {
  @Field(() => Number)
  period_days: number;

  @Field(() => Number)
  total_words_learned: number;

  @Field(() => Number)
  study_days_count: number;

  @Field(() => Number)
  average_words_per_day: number;

  @Field(() => [DailyStatDto])
  daily_records: DailyStatDto[];
}
