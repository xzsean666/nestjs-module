import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SqliteKVDatabase } from '../helpers/sdk/index';
import { config } from '../config';

export { SqliteKVDatabase };

@Injectable()
export class DBLocalMemoryService implements OnModuleDestroy {
  private dbInstances: Map<string, SqliteKVDatabase> = new Map();
  private readonly dbUrl: string;

  constructor() {
    // Use a shared in-memory database so multiple connections (tables) share the same memory DB
    // SQLite connection string docs: file:memdb1?mode=memory&cache=shared
    this.dbUrl = 'file:local_memdb?mode=memory&cache=shared';
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

export const db_local_memory_tables = {
  anbox_meta: 'anbox_meta',
};
