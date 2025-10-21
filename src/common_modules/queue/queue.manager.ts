export interface QueueOptions {
  key?: string | ((...args: any[]) => string);
  timeoutMs?: number;
  throwOnTimeout?: boolean;
}

/**
 * A lightweight in-process queue manager that serializes execution per key.
 * - Ensures FIFO execution for the same key
 * - Does not cross process boundaries
 */
export class QueueManager {
  private readonly queueTails: Map<string, Promise<void>> = new Map();

  enqueue<T>(
    key: string,
    task: () => Promise<T> | T,
    options?: { timeoutMs?: number; throwOnTimeout?: boolean },
  ): Promise<T> {
    const previousTail = this.queueTails.get(key) ?? Promise.resolve();

    let resolveCurrentTail: () => void;
    const currentTail = new Promise<void>((resolve) => {
      resolveCurrentTail = resolve;
    });

    // Set the tail immediately so concurrent enqueues chain correctly
    this.queueTails.set(key, currentTail);

    const runTask = async (): Promise<T> => {
      // Ensure we wait for prior task completion (ignore prior failures to keep queue moving)
      try {
        await previousTail;
      } catch {}

      const maybePromise = (async () => task())();
      return this.withTimeout(
        maybePromise,
        options?.timeoutMs,
        options?.throwOnTimeout,
      );
    };

    const taskPromise = runTask()
      .finally(() => {
        // Mark current tail resolved
        resolveCurrentTail!();
      })
      .finally(() => {
        // Cleanup: if no newer tail has replaced this one, remove the key
        const latestTail = this.queueTails.get(key);
        if (latestTail === currentTail) {
          this.queueTails.delete(key);
        }
      });

    return taskPromise;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number,
    throwOnTimeout: boolean = true,
  ): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (throwOnTimeout) {
          reject(new Error(`Queue task timeout after ${timeoutMs}ms`));
        } else {
          // Resolve with undefined as any; underlying task will still continue in background
          resolve(undefined as unknown as T);
        }
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
