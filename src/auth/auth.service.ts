import { Injectable } from '@nestjs/common';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';
import { SupabaseService } from './supabase.service';
import { cacheFn } from '../common/cache.service';

@Injectable()
export class AuthService {
  constructor(
    private wechatService: WeChatService,
    private userService: UserService,
    private supabaseService: SupabaseService,
  ) {}

  @cacheFn(60 * 60 * 1)
  async wechatLogin(code: string) {
    // Delegate to specialized WeChat service
    const wechatResult = await this.wechatService.verifyToken(code);
    const user_account = `wechat_${wechatResult.user_id}`;
    const user_info = await this.userService.generateToken(user_account);
    return user_info;
  }
  @cacheFn(60 * 60 * 1)
  async supabaseLogin(code: string) {
    try {
      const supabase_user = await this.supabaseService.verifyToken(code);
      if (!supabase_user?.id) {
        throw new Error('Supabase user id not found');
      }
      const user_account = `supabase_${supabase_user.id}`;
      const user_info = await this.userService.generateToken(user_account);
      return user_info;
    } catch (error: any) {
      console.error('supabaseLogin error:', error?.message || error);
      throw new Error(error?.message || 'Invalid code');
    }
  }
  @cacheFn(60 * 60 * 1)
  async mockLogin(user_id = '66666666666666666666666666666666') {
    const user_info = await this.userService.generateToken(user_id);
    return user_info;
  }

  // Additional authentication methods can be added here
  // For example:
  // async googleLogin() { ... }
  // async facebookLogin() { ... }
}
