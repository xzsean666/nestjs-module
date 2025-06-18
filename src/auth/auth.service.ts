import { Injectable } from '@nestjs/common';
import { WeChatService } from './wechat.service';
import { UserService } from './user.service';

@Injectable()
export class AuthService {
  constructor(
    private wechatService: WeChatService,
    private userService: UserService,
  ) {}

  async wechatLogin(code: string) {
    // Delegate to specialized WeChat service
    const wechatResult = await this.wechatService.login(code);
    const user_account = wechatResult.unionid;
    const user_info = await this.userService.generateToken(user_account);
    return user_info;
  }

  async mockLogin(user_id = '66666666666666666666666666666666') {
    const user_info = await this.userService.generateToken(user_id);
    return user_info;
  }
  // Additional authentication methods can be added here
  // For example:
  // async googleLogin() { ... }
  // async facebookLogin() { ... }
}
