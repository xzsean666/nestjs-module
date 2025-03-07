import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { config } from '../config';
import { cacheFn } from './cache.service';

// User Model
@ObjectType()
export class UserModel {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;
}

// Supabase Service
@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
  }

  // 验证 JWT token
  @cacheFn(1 * 60)
  async verifyToken(jwt: string): Promise<User> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(jwt);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // 获取当前认证用户
  async getCurrentUser(): Promise<any> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return user;
  }

  // 获取 Supabase 客户端实例
  getClient(): SupabaseClient {
    return this.supabase;
  }
}

// Auth Guard for GraphQL
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    const token = this.extractTokenFromHeader(req);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const user = await this.supabaseService.verifyToken(token);
      req['user'] = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    const cleanHeader = authHeader?.replace(/"/g, '');
    const [type, token] = cleanHeader?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

// Current User Decorator
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
