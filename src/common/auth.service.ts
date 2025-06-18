import { Injectable } from '@nestjs/common';
import { JWTHelper } from '../helpers/sdk';
import { config } from '../config';
import { IAuthService } from './auth.guard.service';

@Injectable()
export class AuthService implements IAuthService {
  private jwtHelper: JWTHelper;

  constructor() {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  /**
   * Verifies the access token and returns the decoded payload
   * @param token JWT token to verify
   * @returns Decoded token payload
   */
  verifyAccessToken(token: string): Promise<any> {
    return Promise.resolve(this.jwtHelper.verifyToken(token));
  }
}
