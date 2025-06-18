import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import {
  MessageCategory,
  MessageType,
} from '../interfaces/system-message.interface';

registerEnumType(MessageCategory, {
  name: 'MessageCategory',
  description: 'The category of system messages',
});

registerEnumType(MessageType, {
  name: 'MessageType',
  description: 'The type of message (personal or global)',
});

@ObjectType()
export class SystemMessageDto {
  @Field()
  id: string;

  @Field(() => MessageCategory)
  category: MessageCategory;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  createdAt: number;

  @Field({ nullable: true })
  expiresAt?: number;

  @Field(() => MessageType)
  type: MessageType;

  @Field({ nullable: true })
  userId?: string;

  @Field()
  isRead: boolean;
}

export { MessageCategory, MessageType };
