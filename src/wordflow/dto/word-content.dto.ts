import { Field, ObjectType } from '@nestjs/graphql';
import { BaseWordDto } from './base-word.dto';

@ObjectType()
export class WordContentDto extends BaseWordDto {
  @Field(() => String, { nullable: true })
  example?: string;

  @Field(() => String, { nullable: true })
  translation?: string;

  @Field(() => String, { nullable: true })
  explanation?: string;

  @Field(() => [String], { nullable: true })
  synonyms?: string[];

  @Field(() => [String], { nullable: true })
  related_words?: string[];
}
