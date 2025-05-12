// import { Injectable } from '@nestjs/common';
// import { DBService, KVDatabase } from './db.service';
// import { OTPUtils, JWTHelper, CryptoHelper } from '../helpers/sdk';
// import { randomUUID } from 'crypto';
// import { config } from '../config';

// @Injectable()
// export class OTPService {
//   protected readonly dbService: DBService;
//   protected readonly userOTPDB: KVDatabase;
//   protected readonly inviteCodeDB: KVDatabase;
//   protected readonly otpUtils: OTPUtils;

//   protected readonly jwtHelper: JWTHelper;

//   constructor() {
//     this.dbService = new DBService();
//     this.inviteCodeDB = this.dbService.getDBInstance('invite_code');
//     this.userOTPDB = this.dbService.getDBInstance('user_otp');
//     this.otpUtils = new OTPUtils();
//     this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
//   }
//   async createInviteCode(username: string) {
//     const inviteCode = randomUUID();
//     await this.inviteCodeDB.put(inviteCode, {
//       code: inviteCode.slice(0, 6),
//       username,
//     });
//     return inviteCode.slice(0, 6);
//   }
//   async verifyInviteCode(inviteCode: string) {
//     // 使用简单的文本比较
//     const result = await this.inviteCodeDB.searchJson({
//       contains: {
//         code: inviteCode,
//       },
//     });

//     return result.data.length > 0;
//   }
//   async encodeSecret(secret: string) {
//     return CryptoHelper.encryptAES(secret, config.auth.JWT_SECRET);
//   }
//   async decodeSecret(secret: string) {
//     return CryptoHelper.decryptAES(secret, config.auth.JWT_SECRET);
//   }
//   async generateOTP(username: string, inviteCode: string) {
//     const isValid = await this.verifyInviteCode(inviteCode);
//     if (!isValid) {
//       throw new Error('Invalid invite code');
//     }
//     const userOTP = await this.userOTPDB.get(username);
//     if (userOTP && userOTP.isActive) {
//       throw new Error('User already has OTP');
//     }

//     const result = await this.otpUtils.newSecret(username, 'Trading Dashboard');
//     const encryptedSecret = await this.encodeSecret(result.secret);
//     await this.userOTPDB.merge(username, {
//       secret: encryptedSecret,
//       isActive: false,
//     });

//     return {
//       secret: result.secret,
//       otpauth: result.otpauth,
//       imageUrl: result.imageUrl,
//     };
//   }
//   async registerOTP(username: string, token: string) {
//     const userOTP = await this.userOTPDB.get(username);
//     if (!userOTP) {
//       throw new Error('User not found');
//     }
//     const decodedSecret = await this.decodeSecret(userOTP.secret);
//     const isValid = this.otpUtils.verifyToken(token, decodedSecret);
//     if (!isValid) {
//       throw new Error('Invalid OTP');
//     }
//     if (userOTP && userOTP.isActive) {
//       throw new Error('User already has OTP');
//     }
//     await this.userOTPDB.merge(username, {
//       isActive: true,
//     });
//     return true;
//   }
//   async loginOTP(username: string, token: string) {
//     const userOTP = await this.userOTPDB.get(username);
//     if (!userOTP) {
//       throw new Error('User not found');
//     }
//     if (!userOTP.isActive) {
//       throw new Error('User not Active');
//     }
//     const decodedSecret = await this.decodeSecret(userOTP.secret);
//     const isValid = this.otpUtils.verifyToken(token, decodedSecret);
//     if (!isValid) {
//       throw new Error('Invalid OTP');
//     }
//     const accessToken = this.jwtHelper.generateToken(
//       {
//         username,
//         isActive: userOTP.isActive,
//       },
//       Number(config.auth.JWT_EXPIRES_IN),
//     );
//     return accessToken;
//   }
//   async verifyAccessToken(accessToken: string) {
//     try {
//       const decoded = this.jwtHelper.verifyToken(accessToken);
//       return decoded;
//     } catch {
//       throw new Error('Invalid access token');
//     }
//   }
// }
