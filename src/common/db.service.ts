import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { KVDatabase } from '../utils/PGKVDatabase';
import { config } from '../config';

@Injectable()
export class DBService implements OnModuleDestroy {
  private dbInstances: Map<string, KVDatabase> = new Map();
  private readonly dbUrl: string;

  constructor() {
    const dbUrl = config.database.url;
    if (!dbUrl) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }
    this.dbUrl = dbUrl;
  }

  getDBInstance(tableName: string): KVDatabase {
    if (!this.dbInstances.has(tableName)) {
      this.dbInstances.set(tableName, new KVDatabase(this.dbUrl, tableName));
    }
    return this.dbInstances.get(tableName) as KVDatabase;
  }

  async onModuleDestroy() {
    for (const db of this.dbInstances.values()) {
      await db.close();
    }
    this.dbInstances.clear();
  }
}
