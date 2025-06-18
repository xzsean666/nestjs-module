import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';

import {
  WordFlowVocabularyType,
  WordFlowInterestTagType,
  WordFlowPhaseType,
} from 'src/types';

@ObjectType('UserMeta')
@InputType('UserMetaInput')
export class UserMetaDto {
  @Field(() => WordFlowVocabularyType, { nullable: true })
  current_vocabulary?: WordFlowVocabularyType;

  @Field(() => String, { nullable: true })
  target_timestamp?: string;

  @Field(() => WordFlowPhaseType, { nullable: true })
  study_phase?: WordFlowPhaseType;

  @Field(() => [WordFlowInterestTagType], { nullable: true })
  interest_tag?: WordFlowInterestTagType[];

  @Field(() => String, { nullable: true })
  registration_id?: string;
}
