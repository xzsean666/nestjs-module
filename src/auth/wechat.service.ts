import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { config } from '../config';
import axios from 'axios';

interface WeChatLoginResult {
  session_key: string;
  openid: string;
  unionid?: string;
}

@Injectable()
export class WeChatService {
  // Hard-coded values or environment variables can be used directly
  private readonly appId = config.wechat.WECHAT_APP_ID;
  private readonly appSecret = config.wechat.WECHAT_APP_SECRET;

  async verifyToken(code: string) {
    try {
      if (!this.appId || !this.appSecret) {
        throw new HttpException(
          'WeChat app configuration is missing',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 调用微信登录凭证校验接口
      const response = await axios.get<WeChatLoginResult>(
        'https://api.weixin.qq.com/sns/jscode2session',
        {
          params: {
            appid: this.appId,
            secret: this.appSecret,
            js_code: code,
            grant_type: 'authorization_code',
          },
        },
      );

      if (!response.data.openid) {
        throw new HttpException(
          'Failed to get WeChat openid',
          HttpStatus.BAD_REQUEST,
        );
      }

      const userId = response.data.unionid || response.data.openid;
      if (!userId) {
        throw new HttpException(
          'Failed to resolve WeChat user id',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        openid: response.data.openid,
        sessionKey: response.data.session_key,
        unionid: response.data.unionid,
        user_id: userId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('WeChat login failed', error);
      throw new HttpException(
        'WeChat login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
