import { Injectable } from '@nestjs/common';
import { config } from '../config';
import { JWTHelper } from '../helpers/sdk';

@Injectable()
export class SubscriptionTokenService {
  private jwtService: JWTHelper;
  constructor() {
    this.jwtService = new JWTHelper(config.supabase.key);
  }
  // 为用户创建一次性订阅令牌
  generateSubscriptionToken(userId: string, chatId: string): string {
    return this.jwtService.generateToken(
      {
        userId,
        chatId,
        type: 'subscription',
      },
      60 * 60 * 24 * 30, // 30天有效期
    );
  }

  // 验证订阅令牌
  verifySubscriptionToken(
    token: string,
  ): { userId: string; chatId: string } | null {
    try {
      const payload = this.jwtService.verifyToken(token);

      if (payload.type !== 'subscription') {
        return null;
      }

      return {
        userId: payload.userId,
        chatId: payload.chatId,
      };
    } catch (error) {
      return null;
    }
  }
}
