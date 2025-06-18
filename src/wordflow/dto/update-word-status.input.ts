import { Field, InputType } from '@nestjs/graphql';
import { WordFlowCardType } from 'src/types';
import { BaseWordInput } from './base-word.input';

@InputType()
export class UpdateWordStatusInput extends BaseWordInput {
  @Field(() => WordFlowCardType)
  card_type: WordFlowCardType;
}

@InputType()
export class UpdateWordsStatusBulkInput {
  @Field(() => [String])
  words!: string[];

  @Field(() => WordFlowCardType)
  card_type!: WordFlowCardType;
}
