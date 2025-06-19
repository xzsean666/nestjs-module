import { Injectable } from '@nestjs/common';
import { DBService, PGKVDatabase } from '../common/db.service';
import { OTPUtils, JWTHelper, CryptoHelper } from '../helpers/sdk';
import { config } from '../config';

@Injectable()
export class OTPService {
  protected readonly dbService: DBService;
  protected readonly userOTPDB: PGKVDatabase;
  protected readonly otpUtils: OTPUtils;
  protected readonly jwtHelper: JWTHelper;

  constructor() {
    this.dbService = new DBService();
    this.userOTPDB = this.dbService.getDBInstance('user_otp');
    this.otpUtils = new OTPUtils();
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  encodeSecret(secret: string) {
    return CryptoHelper.encryptAES(secret, config.auth.JWT_SECRET);
  }
  decodeSecret(secret: string) {
    return CryptoHelper.decryptAES(secret, config.auth.JWT_SECRET);
  }
  async generateOTP(username: string, inviteCode: string) {
    const userOTP = await this.userOTPDB.get(username);
    if (userOTP && userOTP.isActive) {
      throw new Error('User already has OTP');
    }

    const result = await this.otpUtils.newSecret(username, 'Trading Dashboard');
    const encryptedSecret = this.encodeSecret(result.secret);
    await this.userOTPDB.merge(username, {
      secret: encryptedSecret,
      isActive: false,
    });

    return {
      secret: result.secret,
      otpauth: result.otpauth,
      imageUrl: result.imageUrl,
    };
  }
  async registerOTP(username: string, token: string) {
    const userOTP = await this.userOTPDB.get(username);
    if (!userOTP) {
      throw new Error('User not found');
    }
    const decodedSecret = this.decodeSecret(userOTP.secret);
    const isValid = this.otpUtils.verifyToken(token, decodedSecret);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }
    if (userOTP && userOTP.isActive) {
      throw new Error('User already has OTP');
    }
    await this.userOTPDB.merge(username, {
      isActive: true,
    });
    return true;
  }
  async loginOTP(username: string, token: string) {
    const userOTP = await this.userOTPDB.get(username);
    if (!userOTP) {
      throw new Error('User not found');
    }
    if (!userOTP.isActive) {
      throw new Error('User not Active');
    }
    const decodedSecret = this.decodeSecret(userOTP.secret);
    const isValid = this.otpUtils.verifyToken(token, decodedSecret);
    if (!isValid) {
      throw new Error('Invalid OTP');
    }
    const accessToken = this.jwtHelper.generateToken(
      {
        user_id: username,
        isActive: userOTP.isActive,
      },
      Number(config.auth.JWT_EXPIRES_IN),
    );
    return accessToken;
  }
  verifyToken(accessToken: string) {
    try {
      const decoded = this.jwtHelper.verifyToken(accessToken);
      return decoded;
    } catch {
      throw new Error('Invalid access token');
    }
  }
}
