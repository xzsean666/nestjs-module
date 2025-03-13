import { createCacheDecorator } from '../helpers/sdk';
import { SqliteKVDatabase } from '../helpers/sdk/';

export const cacheFn = createCacheDecorator(new SqliteKVDatabase('cache.db'));
export const cacheMemoFn = createCacheDecorator(new SqliteKVDatabase());
