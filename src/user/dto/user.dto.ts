import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType('ProfileInput')
@ObjectType('Profile')
export class Profile {
  @Field(() => String, { nullable: true })
  real_name?: string;

  @Field(() => String, { nullable: true })
  official_id?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  preferred_language?: string;
}

// @InputType()
// export class UpdateProfileInput extends ProfileBase {}
