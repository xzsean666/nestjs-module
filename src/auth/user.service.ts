import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DBService, db_tables, PGKVDatabase } from '../common/db.service';
import { CryptoHelper } from '../helpers/utils/encodeUtils/cryptoHelper';
import { JWTHelper } from '../helpers/utils/encodeUtils/jwtHelper';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class UserService {
  private userDb: PGKVDatabase;
  private jwtHelper: JWTHelper;
  constructor(private dbService: DBService) {
    this.dbService = dbService;
    this.userDb = dbService.getDBInstance(db_tables.user_db);
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  /**
   * 注册新用户
   */
  async register(user_account: string): Promise<string> {
    const user = await this.userDb.get(user_account);
    if (user) {
      throw new ConflictException('User already exists');
    }
    const user_id = uuidv4();
    await this.userDb.put(user_account, user_id);
    return user_id;
  }

  async login(user_account: string): Promise<string> {
    const user_id = await this.userDb.get(user_account);
    if (!user_id) {
      throw new BadRequestException('User not found');
    }
    return user_id;
  }
  async getUserId(user_account: string): Promise<string> {
    let user_id = await this.userDb.get(user_account);
    if (!user_id) {
      user_id = await this.register(user_account);
    }
    return user_id;
  }
  async generateToken(
    user_account: string,
  ): Promise<{ token: string; user_id: string }> {
    const user_id = await this.getUserId(user_account);
    const token = this.jwtHelper.generateToken(
      { user_id, user_account },
      config.auth.JWT_EXPIRES_IN,
    );
    return { token, user_id };
  }
}
