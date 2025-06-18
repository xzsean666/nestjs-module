import { Field, ObjectType } from '@nestjs/graphql';
import { WordFlowMarkedWordTag } from 'src/types';
import { BaseWordDto } from './base-word.dto';

@ObjectType()
export class MarkedWordDto extends BaseWordDto {
  @Field(() => WordFlowMarkedWordTag, { nullable: true })
  tag?: WordFlowMarkedWordTag;
}
