import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'os';
import { DBLocalService } from '../../common/db.local.service';
import { DBLocalMemoryService } from '../../common/db.local.memory.service';
import type { SqliteKVDatabase } from '../../helpers/sdk/index';

export interface LockConfig {
  lockKey: string;
  maxLockTime?: number; // 最大锁定时间（毫秒），默认 30 分钟
  retryInterval?: number; // 重试间隔（毫秒），默认 1 秒
  maxRetries?: number; // 最大重试次数，默认 3 次
}

export interface LockResult {
  success: boolean;
  lockId?: string;
  message?: string;
}

interface LockData {
  lockId: string;
  createdAt: number;
  expiresAt: number;
  processId: string;
  hostname: string;
}

interface LocalDBProvider {
  getDBInstance(tableName: string): SqliteKVDatabase;
}

class BaseDistributedLockService {
  protected readonly logger: Logger;
  protected readonly processId: string;
  protected readonly hostname: string;
  protected readonly dbProvider: LocalDBProvider;

  constructor(dbProvider: LocalDBProvider) {
    this.logger = new Logger((this as any).constructor.name);
    this.processId = `${process.pid}_${Date.now()}`;
    this.hostname = hostname();
    this.dbProvider = dbProvider;
  }

  /**
   * 尝试获取分布式锁
   */
  async acquireLock(config: LockConfig): Promise<LockResult> {
    const {
      lockKey,
      maxLockTime = 30 * 60 * 1000, // 30 分钟
      retryInterval = 1000, // 1 秒
      maxRetries = 3,
    } = config;

    const lockId = this.generateLockId();
    const db = this.dbProvider.getDBInstance('distributed_locks');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 首先清理过期的锁
        await this.cleanupExpiredLocks(lockKey);

        // 尝试获取锁
        const lockData: LockData = {
          lockId,
          createdAt: Date.now(),
          expiresAt: Date.now() + maxLockTime,
          processId: this.processId,
          hostname: this.hostname,
        };

        // 使用 add 方法确保原子性 - 如果 key 已存在会抛出错误
        await db.add(lockKey, lockData);

        // this.logger.log(
        //   `成功获取分布式锁: ${lockKey} (lockId: ${lockId}, attempt: ${attempt + 1})`,
        // );

        return {
          success: true,
          lockId,
          message: `成功获取锁 ${lockKey}`,
        };
      } catch (error) {
        // 检查是否是因为 key 已存在
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          // 锁已被其他进程持有
          if (attempt < maxRetries) {
            this.logger.warn(
              `锁 ${lockKey} 已被持有，等待 ${retryInterval}ms 后重试 (attempt: ${attempt + 1}/${maxRetries + 1})`,
            );
            await this.sleep(retryInterval);
            continue;
          } else {
            this.logger.warn(
              `无法获取锁 ${lockKey}，已达到最大重试次数 (${maxRetries + 1})`,
            );
            return {
              success: false,
              message: `无法获取锁 ${lockKey}，锁被其他进程持有`,
            };
          }
        } else {
          // 其他错误
          this.logger.error(`获取锁 ${lockKey} 时发生错误:`, error);
          return {
            success: false,
            message: `获取锁时发生错误: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }
    }

    return {
      success: false,
      message: `获取锁 ${lockKey} 失败`,
    };
  }

  /**
   * 释放分布式锁
   */
  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');

      // 验证锁的所有权
      const existingLock = await db.get<LockData>(lockKey);
      if (!existingLock) {
        this.logger.warn(`尝试释放不存在的锁: ${lockKey}`);
        return false;
      }

      if (existingLock.lockId !== lockId) {
        this.logger.warn(
          `尝试释放不属于当前进程的锁: ${lockKey} (expected: ${lockId}, actual: ${existingLock.lockId})`,
        );
        return false;
      }

      // 删除锁
      const deleted = await db.delete(lockKey);
      if (deleted) {
        // this.logger.log(`成功释放分布式锁: ${lockKey} (lockId: ${lockId})`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`释放锁 ${lockKey} 时发生错误:`, error);
      return false;
    }
  }

  /**
   * 检查锁状态
   */
  async getLockStatus(lockKey: string): Promise<LockData | null> {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');
      const lockData = await db.get<LockData>(lockKey);

      if (!lockData) {
        return null;
      }

      // 检查是否过期
      if (Date.now() > lockData.expiresAt) {
        // 清理过期锁
        await this.cleanupExpiredLocks(lockKey);
        return null;
      }

      return lockData;
    } catch (error) {
      this.logger.error(`检查锁状态时发生错误:`, error);
      return null;
    }
  }

  /**
   * 强制释放锁（管理员功能）
   */
  async forceReleaseLock(lockKey: string): Promise<boolean> {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');
      const deleted = await db.delete(lockKey);

      if (deleted) {
        this.logger.log(`强制释放锁: ${lockKey}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`强制释放锁时发生错误:`, error);
      return false;
    }
  }

  /**
   * 清理过期的锁
   */
  private async cleanupExpiredLocks(lockKey?: string): Promise<void> {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');
      const now = Date.now();

      if (lockKey) {
        // 清理特定的锁
        const lockData = await db.get<LockData>(lockKey);
        if (lockData && now > lockData.expiresAt) {
          await db.delete(lockKey);
          this.logger.log(`清理过期锁: ${lockKey}`);
        }
      } else {
        // 清理所有过期锁（定期清理）
        const allKeys = await db.keys();
        for (const key of allKeys) {
          const lockData = await db.get<LockData>(key);
          if (lockData && now > lockData.expiresAt) {
            await db.delete(key);
            this.logger.log(`清理过期锁: ${key}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('清理过期锁时发生错误:', error);
    }
  }

  /**
   * 执行带锁的操作
   */
  async executeWithLock<T>(
    config: LockConfig,
    operation: () => Promise<T>,
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lockResult = await this.acquireLock(config);

    if (!lockResult.success) {
      return {
        success: false,
        error: lockResult.message,
      };
    }

    let result: T;
    try {
      result = await operation();
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // 确保释放锁
      if (lockResult.lockId) {
        await this.releaseLock(config.lockKey, lockResult.lockId);
      }
    }
  }

  /**
   * 生成唯一锁 ID
   */
  private generateLockId(): string {
    return `${this.processId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 睡眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取当前进程的锁信息
   */
  async getProcessLocks(): Promise<
    Array<{ lockKey: string; lockData: LockData }>
  > {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');
      const allKeys = await db.keys();
      const processLocks: Array<{ lockKey: string; lockData: LockData }> = [];

      for (const key of allKeys) {
        const lockData = await db.get<LockData>(key);
        if (lockData && lockData.processId === this.processId) {
          processLocks.push({ lockKey: key, lockData });
        }
      }

      return processLocks;
    } catch (error) {
      this.logger.error('获取进程锁信息时发生错误:', error);
      return [];
    }
  }

  /**
   * 清除所有的锁（管理员功能）
   */
  async clearAllLocks(): Promise<{ total: number; deleted: number }> {
    try {
      const db = this.dbProvider.getDBInstance('distributed_locks');
      const allKeys = await db.keys();

      let deletedCount = 0;
      for (const key of allKeys) {
        const deleted = await db.delete(key);
        if (deleted) {
          deletedCount += 1;
        }
      }

      this.logger.log(`已清除 ${deletedCount}/${allKeys.length} 个锁`);
      return { total: allKeys.length, deleted: deletedCount };
    } catch (error) {
      this.logger.error('清除所有锁时发生错误:', error);
      return { total: 0, deleted: 0 };
    }
  }
}

@Injectable()
export class DistributedLockService extends BaseDistributedLockService {
  constructor(dbLocalService: DBLocalService) {
    super(dbLocalService);
  }
}

@Injectable()
export class DistributedLockMemoryService extends BaseDistributedLockService {
  constructor(dbLocalMemoryService: DBLocalMemoryService) {
    super(dbLocalMemoryService);
  }
}
