import { Resolver, Args, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { GraphQLJSON } from 'graphql-type-json';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from './auth.guard.service';
import { LoginResult } from './dto/login-result.dto';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  // @Query(() => LoginResult)
  // async wechatLogin(@Args('code') code: string) {
  //   return this.authService.wechatLogin(code);
  // }

  // @Query(() => LoginResult)
  // async supabaseLogin(@Args('code') code: string) {
  //   return this.authService.supabaseLogin(code);
  // }

  // @Query(() => LoginResult)
  // async mockLogin(@Args('user_id', { nullable: true }) user_id?: string) {
  //   return this.authService.mockLogin(user_id);
  // }
  // @Query(() => GraphQLJSON)
  // @UseGuards(AuthGuard)
  // currentUser(@CurrentUser() user: any) {
  //   return user;
  // }
}
