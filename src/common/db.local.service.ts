import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SqliteKVDatabase } from '../helpers/sdk/index';
import { config } from '../config';

export { SqliteKVDatabase };

@Injectable()
export class DBLocalService implements OnModuleDestroy {
  private dbInstances: Map<string, SqliteKVDatabase> = new Map();
  private readonly dbUrl: string;

  constructor() {
    const dbUrl = 'db/db.sqlite';
    if (!dbUrl) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }
    this.dbUrl = dbUrl;
  }

  getDBInstance(tableName: string): SqliteKVDatabase {
    tableName = `${config.database.prefix}_${tableName}`;
    if (!this.dbInstances.has(tableName)) {
      this.dbInstances.set(
        tableName,
        new SqliteKVDatabase(this.dbUrl, tableName),
      );
    }
    return this.dbInstances.get(tableName) as SqliteKVDatabase;
  }

  async onModuleDestroy() {
    for (const db of this.dbInstances.values()) {
      await db.close();
    }
    this.dbInstances.clear();
  }
}

export const db_local_tables = {
  lst: 'db_lst',
};
