import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class BaseWordInput {
  @Field(() => String)
  word: string;
}
