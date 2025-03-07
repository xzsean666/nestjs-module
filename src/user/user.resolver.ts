import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SupabaseAuthGuard, CurrentUser } from '../common/supabase.service';
import type { User } from '@supabase/supabase-js';
import { UseGuards } from '@nestjs/common';
import { cacheFn } from '../common/cache.service';
import { UserService } from './user.service';
import { Profile } from './dto/user.dto';
import { CheckinStats, MonthlyCheckin } from './dto/checkin.dto';
import { Int } from '@nestjs/graphql';

@Resolver(() => JSON)
@UseGuards(SupabaseAuthGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => Profile, { nullable: true })
  @cacheFn(1 * 60 * 60)
  userPrivateProfile(@CurrentUser() user: User) {
    return this.userService.getUserPrivateProfile(user);
  }

  @Mutation(() => JSON)
  async updateUserPrivateProfile(
    @CurrentUser() user: User,
    @Args('profile', { type: () => Profile }) profile: any,
  ) {
    return this.userService.updateUserPrivateProfile(user, profile);
  }

  @Mutation(() => JSON)
  async userCheckin(@CurrentUser() user: User) {
    return this.userService.userCheckin(user);
  }

  @Query(() => CheckinStats)
  async CheckinStats(@CurrentUser() user: User) {
    return this.userService.getCheckinStats(user);
  }

  @Query(() => MonthlyCheckin)
  async CurrentMonthCheckin(@CurrentUser() user: User) {
    return this.userService.getCurrentMonthCheckin(user);
  }

  @Query(() => MonthlyCheckin)
  async CheckinHistory(
    @CurrentUser() user: User,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
  ) {
    return this.userService.getCheckinHistory(user, year, month);
  }
}
