import { QueueManager, QueueOptions } from './queue.manager';

// A single global QueueManager instance; for per-scope queues, you can instantiate separately
const globalQueue = new QueueManager();

/**
 * Decorator to serialize method execution per derived key.
 * Example:
 *  @Queueable({ key: (userId: string) => `user:${userId}` })
 *  async updateUser(userId: string) { ... }
 */
export function QueueableInMemory(options: QueueOptions = {}): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value;

    if (typeof original !== 'function') {
      throw new Error('@Queueable can only be applied to methods');
    }

    descriptor.value = function (...args: any[]) {
      const key = resolveKey(options.key, target, propertyKey, args);
      return globalQueue.enqueue(
        key,
        async () => await original.apply(this, args),
        {
          timeoutMs: options.timeoutMs,
          throwOnTimeout: options.throwOnTimeout,
        },
      );
    };

    return descriptor;
  };
}

function resolveKey(
  keyOpt: QueueOptions['key'],
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

  // Default: className:methodName → serialize all calls of this method across the app
  return `${target.constructor?.name}:${String(propertyKey)}`;
}

export { globalQueue };
