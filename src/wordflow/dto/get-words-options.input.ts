import { InputType, Field, Int } from '@nestjs/graphql';
import { WordFlowSortBy, WordFlowSortOrder } from '../../types/wordFlow';

@InputType()
export class GetWordsOptionsInput {
  @Field(() => WordFlowSortBy, { nullable: true })
  sortBy?: WordFlowSortBy;

  @Field(() => WordFlowSortOrder, { nullable: true })
  sortOrder?: WordFlowSortOrder;

  @Field(() => Int, { defaultValue: 0 })
  offset?: number;

  @Field(() => Int, { defaultValue: 10 })
  limit?: number;

  @Field(() => String, { nullable: true })
  search?: string;
}
