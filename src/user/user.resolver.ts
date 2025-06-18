import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UserService } from './user.service';
import { GraphQLJSON } from 'graphql-type-json';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../common/auth.guard.service';
import { UserMetaDto } from './dto/userMeta.dto';
import { CheckinStats, MonthlyCheckin, WeeklyCheckin } from './dto/checkin.dto';
import { CheckinService } from './checkin.service';
import { SystemMessageService } from './systemMessage.service';
import {
  SystemMessageDto,
  MessageCategory,
  MessageType,
} from './dto/systemMessage.dto';

import { Int } from '@nestjs/graphql';
@Resolver('User')
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly checkinService: CheckinService,
    private readonly systemMessageService: SystemMessageService,
  ) {}

  @Query(() => UserMetaDto)
  async getUserMeta(@CurrentUser() user: any) {
    return this.userService.getUserMeta(user.user_id);
  }

  @Mutation(() => Boolean)
  async updateUserMeta(
    @Args('value', { type: () => UserMetaDto }) value: UserMetaDto,
    @CurrentUser() user: any,
  ) {
    return this.userService.updateUserMeta(user.user_id, value);
  }

  @Mutation(() => Boolean)
  async deleteUserMeta(@CurrentUser() user: any) {
    return this.userService.deleteUserMeta(user.user_id);
  }

  @Mutation(() => GraphQLJSON)
  async userCheckin(@CurrentUser() user: any) {
    return this.checkinService.userCheckin(user.user_id);
  }

  @Query(() => CheckinStats)
  async CheckinStats(@CurrentUser() user: any) {
    return this.checkinService.getCheckinStats(user.user_id);
  }

  @Query(() => MonthlyCheckin)
  async CurrentMonthCheckin(@CurrentUser() user: any) {
    return this.checkinService.getCurrentMonthCheckin(user.user_id);
  }

  @Query(() => WeeklyCheckin)
  async CurrentWeekCheckin(@CurrentUser() user: any) {
    return this.checkinService.getCurrentWeekCheckin(user.user_id);
  }

  @Query(() => MonthlyCheckin)
  async CheckinHistory(
    @CurrentUser() user: any,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
  ) {
    return this.checkinService.getCheckinHistory(user.user_id, year, month);
  }

  // 整合后的消息接口
  @Query(() => [SystemMessageDto])
  async getMessages(
    @CurrentUser() user: any,
    @Args('filter', { type: () => String, nullable: true, defaultValue: 'all' })
    filter: 'all' | 'unread' | 'read' = 'all',
    @Args('category', { type: () => MessageCategory, nullable: true })
    category?: MessageCategory,
    @Args('type', { type: () => MessageType, nullable: true })
    type?: MessageType,
  ) {
    return this.systemMessageService.getFilteredMessages(
      user.user_id,
      filter,
      category,
      type,
    );
  }

  @Query(() => Int)
  async getUnreadCount(@CurrentUser() user: any) {
    return this.systemMessageService.getUnreadMessageCount(user.user_id);
  }

  @Mutation(() => SystemMessageDto)
  async createMessage(
    @CurrentUser() user: any,
    @Args('title') title: string,
    @Args('content') content: string,
    @Args('category', { type: () => MessageCategory })
    category: MessageCategory,
    @Args('type', {
      type: () => MessageType,
      defaultValue: MessageType.PERSONAL,
    })
    type: MessageType = MessageType.PERSONAL,
    @Args('recipients', { type: () => [String], nullable: true })
    recipients?: string[],
    @Args('expiresAt', { nullable: true }) expiresAt?: number,
  ) {
    // const isAdmin = user.isAdmin;
    const isAdmin = true;
    return this.systemMessageService.createMessageByType(
      user.user_id,
      isAdmin,
      title,
      content,
      category,
      type,
      recipients,
      expiresAt,
    );
  }

  @Mutation(() => Boolean)
  async markAsRead(
    @CurrentUser() user: any,
    @Args('messageId', { nullable: true }) messageId?: string,
    @Args('all', { type: () => Boolean, defaultValue: false })
    all: boolean = false,
    @Args('type', { type: () => MessageType, nullable: true })
    type?: MessageType,
  ) {
    return this.systemMessageService.smartMarkAsRead(
      user.user_id,
      messageId,
      all,
      type,
    );
  }

  @Mutation(() => Boolean)
  async deleteMessage(
    @CurrentUser() user: any,
    @Args('messageId') messageId: string,
  ) {
    return this.systemMessageService.deleteMessageWithAuth(
      user.user_id,
      user.isAdmin,
      messageId,
    );
  }

  @Mutation(() => Number)
  async cleanupExpiredMessages(
    @CurrentUser() user: any,
    @Args('type', { type: () => MessageType, nullable: true })
    type?: MessageType,
  ) {
    return this.systemMessageService.cleanupExpiredMessagesByType(
      user.isAdmin,
      type,
    );
  }
}
