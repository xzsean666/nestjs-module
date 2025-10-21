import { DistributedLockService } from '../distributed-lock/distributed-lock.service';
import { DBLocalService } from '../../common/db.local.service';

export interface DistributedQueueOptions {
  key?: string | ((...args: any[]) => string);
  retryInterval?: number; // ms, default 1000
  maxLockTime?: number; // ms, default 30 minutes (follow service default)
}

// Use file-based SQLite DBLocalService by default for cross-instance coordination
const sqliteLockService = new DistributedLockService(new DBLocalService());

export function Queueable(
  options: DistributedQueueOptions = {},
): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value;
    if (typeof original !== 'function') {
      throw new Error('@DistributedQueueable can only be applied to methods');
    }

    descriptor.value = async function (...args: any[]) {
      const key = resolveKey(options.key, target, propertyKey, args);
      const retryInterval = options.retryInterval ?? 1000;
      const maxLockTime = options.maxLockTime; // use service default if undefined

      // Acquire lock with indefinite retry (queueing behavior across instances)
      let lockId: string | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await sqliteLockService.acquireLock({
          lockKey: key,
          retryInterval,
          maxRetries: 0, // single attempt per loop; we handle waiting here
          maxLockTime,
        });

        if (result.success && result.lockId) {
          lockId = result.lockId;
          break;
        }

        await sleep(retryInterval);
      }

      try {
        return await original.apply(this, args);
      } finally {
        if (lockId) {
          await sqliteLockService.releaseLock(key, lockId);
        }
      }
    };

    return descriptor;
  };
}

function resolveKey(
  keyOpt: DistributedQueueOptions['key'],
  target: any,
  propertyKey: string | symbol,
  args: any[],
): string {
  if (typeof keyOpt === 'function') {
    try {
      const k = keyOpt(...args);
      return String(k ?? `${target.constructor?.name}:${String(propertyKey)}`);
    } catch {
      return `${target.constructor?.name}:${String(propertyKey)}`;
    }
  }

  if (typeof keyOpt === 'string' && keyOpt.length > 0) {
    return keyOpt;
  }

  return `${target.constructor?.name}:${String(propertyKey)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
