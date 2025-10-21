# 分布式锁模块 (Distributed Lock Module)

这个模块提供了基于 SQLite 的分布式锁服务，用于解决多进程/多实例环境下的资源竞争问题。

## 主要功能

- **跨进程锁定**：确保同一时间只有一个进程能执行特定任务
- **自动过期**：防止死锁，锁会在指定时间后自动释放
- **锁验证**：确保只有锁的持有者才能释放锁
- **便捷的执行方法**：提供 `executeWithLock` 方法简化使用

## 使用场景

### 1. Cron Job 防重复执行

当使用 PM2 启动多个实例时，防止 cron job 重复执行：

```typescript
// 在 CronManagerService 中已集成
await this.distributedLockService.executeWithLock(
  {
    lockKey: `cron_job_${jobId}`,
    maxLockTime: 30 * 60 * 1000, // 30分钟
    maxRetries: 0, // cron 不重试
  },
  async () => {
    // 执行实际任务
    await this.actualTask();
  },
);
```

### 2. 通用资源锁定

任何需要防止并发执行的场景：

```typescript
const result = await distributedLockService.executeWithLock(
  {
    lockKey: 'unique-operation',
    maxLockTime: 60000, // 1分钟
    retryInterval: 1000, // 1秒重试
    maxRetries: 3,
  },
  async () => {
    // 你的业务逻辑
    return await criticalOperation();
  },
);
```

## API 接口

### LockConfig

```typescript
interface LockConfig {
  lockKey: string; // 锁的唯一标识
  maxLockTime?: number; // 最大锁定时间（毫秒），默认30分钟
  retryInterval?: number; // 重试间隔（毫秒），默认1秒
  maxRetries?: number; // 最大重试次数，默认3次
}
```

### 主要方法

- `acquireLock(config: LockConfig)`: 获取锁
- `releaseLock(lockKey: string, lockId: string)`: 释放锁
- `executeWithLock<T>(config: LockConfig, operation: () => Promise<T>)`: 执行带锁操作
- `getLockStatus(lockKey: string)`: 查看锁状态
- `forceReleaseLock(lockKey: string)`: 强制释放锁（管理员功能）

## PM2 多实例解决方案

使用这个分布式锁模块完美解决了 PM2 多实例启动时 cron job 重复执行的问题：

1. **问题**：PM2 启动多个实例时，每个实例都会运行自己的 cron job
2. **解决**：使用基于 SQLite 的分布式锁，确保同一时间只有一个进程能执行任务
3. **优势**：
   - 无需外部依赖（Redis 等）
   - 基于文件的 SQLite 天然支持跨进程
   - 自动清理过期锁
   - 详细的日志记录

## 测试

运行测试脚本验证多进程场景：

```bash
# 在多个终端中同时运行
npx ts-node src/common_modules/distributed-lock/test-lock.example.ts
```

只有一个进程能获取锁并执行任务，其他进程会被跳过。

## 注意事项

1. **锁过期时间**：设置合理的 `maxLockTime`，避免任务执行时间超过锁过期时间
2. **数据库位置**：确保所有进程都能访问同一个 SQLite 数据库文件
3. **错误处理**：锁会在 finally 块中自动释放，即使任务执行失败
4. **性能考虑**：每次获取锁都会进行数据库操作，频繁调用时注意性能影响
