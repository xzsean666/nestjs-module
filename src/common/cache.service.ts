import { createCacheDecorator } from '../helpers/sdk';
import { SqliteKVDatabase } from '../helpers/sdk/';

export const cacheFn = createCacheDecorator(
  new SqliteKVDatabase('db/cache.db'),
);
export const cacheMemoFn = createCacheDecorator(new SqliteKVDatabase());
