import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DBService, db_tables } from '../common/db.service';
import { PGKVDatabase } from '../common/db.service';
@Injectable()
export class UserService {
  private user_meta_db: PGKVDatabase;
  constructor(private readonly dbService: DBService) {
    this.user_meta_db = this.dbService.getDBInstance(db_tables.user_meta);
  }

  async getUserMeta(user_id: string): Promise<any> {
    const userMeta = await this.user_meta_db.get(user_id);
    if (!userMeta) {
      throw new NotFoundException('User meta not found');
    }
    return userMeta;
  }

  async updateUserMeta(user_id: string, value: any): Promise<boolean> {
    if (value.current_vocabulary || value.target_timestamp) {
      const existingMeta = await this.user_meta_db.get(user_id);

      // 确定要使用的vocabulary和target_timestamp
      const vocabulary =
        value.current_vocabulary || existingMeta?.current_vocabulary;
      const targetTimestamp =
        value.target_timestamp || existingMeta?.target_timestamp;

      // 验证target_timestamp（如果提供了新的）
      if (value.target_timestamp) {
        this.validateTimestamp(value.target_timestamp);
      }

      // 只有当vocabulary和targetTimestamp都存在时才更新all_vocabulary
      if (vocabulary && targetTimestamp) {
        value.all_vocabulary = this.updateAllVocabulary(
          existingMeta?.all_vocabulary || [],
          vocabulary,
          targetTimestamp,
        );
      }
    }

    await this.user_meta_db.merge(user_id, value);
    return true;
  }

  private updateAllVocabulary(
    allVocabulary: any[],
    vocabulary: string,
    targetTimestamp: string,
  ): any[] {
    const existingEntryIndex = allVocabulary.findIndex(
      (entry: any) => entry.vocabulary === vocabulary,
    );

    const updatedAllVocabulary = [...allVocabulary];
    const newEntry = { vocabulary, target_timestamp: targetTimestamp };

    if (existingEntryIndex !== -1) {
      // 更新现有记录
      updatedAllVocabulary[existingEntryIndex] = {
        ...updatedAllVocabulary[existingEntryIndex],
        ...newEntry,
      };
    } else {
      // 添加新记录
      updatedAllVocabulary.push(newEntry);
    }

    return updatedAllVocabulary;
  }

  private validateTimestamp(target_timestamp: string): number {
    // 检查是否为数字字符串
    const timestamp = parseInt(target_timestamp);
    if (isNaN(timestamp)) {
      throw new BadRequestException(
        'target_timestamp must be a valid timestamp string',
      );
    }

    // 检查是否为有效的timestamp（毫秒）
    const targetDate = new Date(timestamp);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException(
        'target_timestamp must be a valid timestamp',
      );
    }

    // 检查是否至少是明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // 设置为明天的00:00:00

    if (targetDate.getTime() < tomorrow.getTime()) {
      throw new BadRequestException(
        'target_timestamp must be at least tomorrow',
      );
    }

    return timestamp;
  }

  async deleteUserMeta(user_id: string): Promise<boolean> {
    await this.user_meta_db.delete(user_id);
    return true;
  }
}
