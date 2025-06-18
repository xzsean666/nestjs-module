import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { VocabularyType } from '../interfaces/ai-cards.interface';

registerEnumType(VocabularyType, {
  name: 'VocabularyType',
  description: 'The type of vocabulary',
});

@ObjectType()
export class StudyCardDto {
  @Field(() => VocabularyType)
  vocabularyType: VocabularyType;

  @Field(() => [String])
  interestTags: string[];

  @Field(() => [String])
  words: string[];

  @Field({ nullable: true })
  image?: string;

  @Field()
  mixedChinese: string;

  @Field()
  englishOnly: string;

  @Field()
  fillInBlanks: string;
}

@ObjectType()
export class GeneratedCardDto {
  @Field(() => [String])
  used_words: string[];

  @Field()
  mixed_chinese: string;

  @Field()
  english_only: string;

  @Field()
  fill_in_blanks: string;
}

@ObjectType()
export class CardGenerationResultDto {
  @Field(() => [GeneratedCardDto])
  cards: GeneratedCardDto[];

  @Field(() => [String])
  hashedIds: string[];
}
