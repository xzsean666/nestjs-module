import { Field, InputType } from '@nestjs/graphql';
import { WordFlowMarkedWordTag } from 'src/types';
import { BaseWordInput } from './base-word.input';

@InputType()
export class WordTagInput extends BaseWordInput {
  @Field(() => WordFlowMarkedWordTag)
  tag: WordFlowMarkedWordTag;
}
