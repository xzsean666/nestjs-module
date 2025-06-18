import {
  Field,
  ObjectType,
  ID,
  registerEnumType,
  InterfaceType,
} from '@nestjs/graphql';

export enum MessageCategory {
  AD = 'ad',
  NOTIFICATION = 'notification',
  SUBSCRIPTION = 'subscription',
  SYSTEM = 'system',
}

export enum MessageType {
  PERSONAL = 'personal',
  GLOBAL = 'global',
}

registerEnumType(MessageCategory, {
  name: 'MessageCategory',
  description: 'Available message categories',
});

registerEnumType(MessageType, {
  name: 'MessageType',
  description: 'Message type: personal or global',
});

@ObjectType()
export class SystemMessageDto {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => MessageCategory)
  category: MessageCategory;

  @Field(() => String)
  title: string;

  @Field(() => String)
  content: string;

  @Field(() => Boolean)
  isRead: boolean;

  @Field(() => Number)
  createdAt: number;

  @Field(() => Number, { nullable: true })
  expiresAt?: number;

  @Field(() => MessageType)
  type: MessageType;
}
