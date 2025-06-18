import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BaseWordDto {
  @Field(() => String)
  word: string;

  @Field(() => Number, { nullable: true })
  updated_at?: number;
}
