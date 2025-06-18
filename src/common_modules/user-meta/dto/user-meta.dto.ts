import { InputType, Field } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class UserMetaDto {
  @Field({ nullable: true })
  current_vocabulary?: string;

  @Field({ nullable: true })
  target_timestamp?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  all_vocabulary?: any[];
}
