import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class LoginResult {
  @Field()
  token: string;

  @Field()
  user_id: string;
}
