import { createCacheDecorator } from '../sdk';
import { SqliteKVDatabase } from '../sdk/';

export const cacheFn = createCacheDecorator(new SqliteKVDatabase('cache.db'));
