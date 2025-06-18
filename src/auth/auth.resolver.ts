import { Resolver, Args, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { GraphQLJSON } from 'graphql-type-json';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Query(() => GraphQLJSON)
  async wechatLogin(@Args('code') code: string) {
    return this.authService.wechatLogin(code);
  }

  @Query(() => GraphQLJSON)
  async mockLogin(@Args('user_id', { nullable: true }) user_id?: string) {
    return this.authService.mockLogin(user_id);
  }
}
