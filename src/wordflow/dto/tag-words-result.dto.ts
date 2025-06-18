import { Field, ObjectType, Int } from '@nestjs/graphql';
import { WordFlowMarkedWordTag } from 'src/types/wordFlow';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class TagWordEntry {
  @Field(() => String)
  word!: string;

  @Field(() => Number, { nullable: true })
  updated_at?: number;

  @Field(() => WordFlowMarkedWordTag, { nullable: true })
  tag?: WordFlowMarkedWordTag;

  @Field(() => GraphQLJSON, { nullable: true })
  explanation?: any;
}

@ObjectType()
export class TagWordsResult {
  @Field(() => Int)
  total!: number;

  @Field(() => [TagWordEntry])
  words!: TagWordEntry[];
}
