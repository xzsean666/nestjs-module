import { Injectable } from '@nestjs/common';
import { DBService, PGKVDatabase } from '../common/db.service';
import { randomUUID } from 'crypto';
import { InviteCodeInfo } from './dto/invite-code.dto';

@Injectable()
export class InviteCodeService {
  protected readonly dbService: DBService;
  protected readonly inviteCodeDB: PGKVDatabase;

  constructor() {
    this.dbService = new DBService();
    this.inviteCodeDB = this.dbService.getDBInstance('invite_code');
  }

  async createInviteCode(username: string): Promise<string> {
    const inviteCode = randomUUID();
    await this.inviteCodeDB.put(inviteCode, {
      code: inviteCode.slice(0, 6),
      username,
    });
    return inviteCode.slice(0, 6);
  }

  async verifyInviteCode(inviteCode: string): Promise<boolean> {
    // 使用简单的文本比较
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });
    const isValid = result.data.length > 0;
    if (!isValid) {
      throw new Error('Invalid invite code');
    }
    return true;
  }

  async getInviteCodeInfo(inviteCode: string): Promise<InviteCodeInfo | null> {
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });

    if (result.data.length > 0) {
      return result.data[0] as InviteCodeInfo;
    }
    return null;
  }

  async deleteInviteCode(inviteCode: string): Promise<boolean> {
    const result = await this.inviteCodeDB.searchJson({
      contains: {
        code: inviteCode,
      },
    });

    if (result.data.length > 0) {
      const key = result.data[0].key;
      await this.inviteCodeDB.delete(key);
      return true;
    }
    return false;
  }
}
