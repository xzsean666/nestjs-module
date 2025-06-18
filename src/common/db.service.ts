import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PGKVDatabase } from '../helpers/utils/dbUtils/KVPostgresql';
import { config } from '../config';

export { PGKVDatabase };

@Injectable()
export class DBService implements OnModuleDestroy {
  private dbInstances: Map<string, PGKVDatabase> = new Map();
  private readonly dbUrl: string;
  constructor() {
    const dbUrl = config.database.url;
    if (!dbUrl) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }
    this.dbUrl = dbUrl;
  }

  getDBInstance(tableName: string): PGKVDatabase {
    if (config.database.prefix) {
      tableName = `${config.database.prefix}_${tableName}`;
    }

    if (!this.dbInstances.has(tableName)) {
      this.dbInstances.set(tableName, new PGKVDatabase(this.dbUrl, tableName));
    }
    return this.dbInstances.get(tableName) as PGKVDatabase;
  }

  async onModuleDestroy() {
    for (const db of this.dbInstances.values()) {
      await db.close();
    }
    this.dbInstances.clear();
  }
}

export const db_tables = {
  user_db: 'user_db',
  user_meta: 'user_meta',
  user_checkin: 'user_checkin',
  cards_db: 'cards_db',
  messages: 'messages',
  message_read_status: 'message_read_status',
  word_flow: 'word_flow',
  word_flow_user_status: 'word_flow_user_status',
  word_flow_user_knowns: 'word_flow_user_knowns',
  vocabularies: 'vocabularies',
  vocabularie_explains: 'vocabularie_explains',
  user_study_cards: 'user_study_cards',
  user_subscription: 'user_subscription',
  all_subscriptions: 'all_subscriptions',
  payment_records: 'payment_records',
  user_payment: 'user_payment',
  promote_codes: 'promote_codes',
};

export const keys = {
  user_study_cards: 'user_study_cards',
  user_study_cards_history: 'user_study_cards_history',
  user_study_cards_favorites: 'user_study_cards_favorites',
  user_study_plans_current: 'user_study_plans_current',
  user_knowns: 'user_knowns',
  user_marked_words: 'user_marked_words',
};
