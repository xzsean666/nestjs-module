import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';
import { SupabaseService } from './supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private wechatService: WeChatService,
    private userService: UserService,
    private supabaseService: SupabaseService,
  ) {}

  async wechatLogin(code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('WeChat code is required');
    }

    const wechatResult = await this.wechatService.verifyToken(code);
    if (!wechatResult?.user_id) {
      throw new UnauthorizedException('Unable to resolve WeChat user');
    }

    const user_account = `wechat_${wechatResult.user_id}`;
    return this.userService.generateToken(user_account);
  }

  async supabaseLogin(code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Supabase token is required');
    }

    try {
      const supabase_user = await this.supabaseService.verifyToken(code);
      if (!supabase_user?.id) {
        throw new UnauthorizedException('Supabase user id not found');
      }
      const user_account = `supabase_${supabase_user.id}`;
      return this.userService.generateToken(user_account);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('supabaseLogin error:', error?.message || error);
      throw new UnauthorizedException('Invalid code');
    }
  }

  async mockLogin(user_id = '66666666666666666666666666666666') {
    return this.userService.generateToken(user_id);
  }

  // Additional authentication methods can be added here
  // For example:
  // async googleLogin() { ... }
  // async facebookLogin() { ... }
}
