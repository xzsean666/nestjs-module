# 通用 Cron 任务管理系统

## 概述

这是一个重构后的通用 cron 任务管理系统，支持多个独立的 cron job，每个 job 可以选择是否使用锁机制。

## 核心特性

- ✅ **多任务支持**：支持注册多个独立的 cron job
- ✅ **可选锁机制**：每个 job 可以独立选择是否需要锁保护
- ✅ **独立状态管理**：每个 job 有独立的执行统计和状态
- ✅ **超时保护**：带锁的 job 支持自定义超时时间
- ✅ **灵活配置**：支持启用/禁用、不同执行频率等
- ✅ **完整的管理接口**：GraphQL 接口支持所有管理操作

## 架构设计

```
src/cron/
├── cron-job.interface.ts    # 接口定义
├── cron-manager.service.ts  # 通用管理器
├── app-cron.service.ts      # 具体任务注册
├── cron.module.ts           # 模块定义
└── README.md               # 使用说明
```

## 快速开始

### 1. 注册一个新的 Cron Job

在 `app-cron.service.ts` 的 `registerJobs()` 方法中添加：

```typescript
// 带锁的任务
this.cronManager.registerJob({
  config: {
    jobId: 'my-task',
    name: '我的任务',
    useLock: true,
    maxExecutionTime: 10 * 60 * 1000, // 10分钟
    enabled: true,
    description: '这是我的自定义任务',
  },
  execute: () => this.myCustomTask(),
});

// 不带锁的任务
this.cronManager.registerJob({
  config: {
    jobId: 'quick-task',
    name: '快速任务',
    useLock: false,
    enabled: true,
    description: '这是一个快速执行的任务',
  },
  execute: () => this.quickTask(),
});
```

### 2. 添加定时触发器

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async executeMyTask() {
  await this.cronManager.executeJob('my-task');
}
```

### 3. 实现任务逻辑

```typescript
private async myCustomTask(): Promise<void> {
  // 你的任务逻辑
  console.log('执行自定义任务');
}
```

## 配置选项

### CronJobConfig

| 属性               | 类型    | 必填 | 说明                               |
| ------------------ | ------- | ---- | ---------------------------------- |
| `jobId`            | string  | ✅   | 任务唯一标识                       |
| `name`             | string  | ✅   | 任务名称                           |
| `useLock`          | boolean | ✅   | 是否使用锁机制                     |
| `maxExecutionTime` | number  | ❌   | 最大执行时间（毫秒），仅锁模式有效 |
| `enabled`          | boolean | ✅   | 是否启用                           |
| `description`      | string  | ❌   | 任务描述                           |

### 锁机制说明

- **带锁 (`useLock: true`)**：

  - 如果上次执行未完成，跳过本次执行
  - 支持超时保护，防止任务卡死
  - 适用于耗时较长或资源密集的任务

- **不带锁 (`useLock: false`)**：
  - 每次都会执行，不管上次是否完成
  - 没有超时保护
  - 适用于快速、轻量级的任务

## GraphQL 接口

### 查询所有任务状态

```graphql
query {
  getAllJobs {
    jobId
    name
    isRunning
    enabled
    lastExecutionTime
    executionCount
    lastExecutionDuration
    lastExecutionStatus
  }
}
```

### 查询特定任务状态

```graphql
query {
  getTaskExecutionStatus(jobId: "main-task-runner") {
    jobId
    name
    isRunning
    lastExecutionTime
    executionCount
  }
}
```

### 手动执行任务

```graphql
mutation {
  manualRunTask(jobId: "main-task-runner") {
    success
    message
    executionTime
    jobId
  }
}
```

### 启用/禁用任务

```graphql
mutation {
  setJobEnabled(jobId: "health-check", enabled: false)
}
```

### 强制停止任务

```graphql
mutation {
  forceStopTask(jobId: "main-task-runner") {
    success
    message
  }
}
```

### 重置统计信息

```graphql
# 重置特定任务
mutation {
  resetTaskStats(jobId: "main-task-runner")
}

# 重置所有任务
mutation {
  resetTaskStats
}
```

## 内置任务

系统默认注册了三个示例任务：

1. **main-task-runner** (带锁)

   - 执行用户配置的主要任务
   - 每分钟检查一次
   - 30分钟超时

2. **health-check** (不带锁)

   - 系统健康检查
   - 每5分钟执行一次

3. **cleanup-task** (带锁)
   - 清理临时文件和过期数据
   - 每小时执行一次
   - 10分钟超时

## 添加自定义任务的完整示例

### 1. 在 `app-cron.service.ts` 中注册

```typescript
private registerJobs() {
  // ... 现有任务 ...

  // 数据同步任务
  this.cronManager.registerJob({
    config: {
      jobId: 'data-sync',
      name: '数据同步任务',
      useLock: true,
      maxExecutionTime: 15 * 60 * 1000, // 15分钟
      enabled: true,
      description: '同步外部数据源',
    },
    execute: () => this.syncExternalData(),
  });
}

@Cron('0 */30 * * * *') // 每30分钟
async executeDataSync() {
  await this.cronManager.executeJob('data-sync');
}

private async syncExternalData(): Promise<void> {
  // 实现数据同步逻辑
  console.log('开始同步外部数据...');
  // 你的同步逻辑
  console.log('数据同步完成');
}
```

### 2. 通过 GraphQL 管理

```graphql
# 检查任务状态
query {
  getTaskExecutionStatus(jobId: "data-sync") {
    isRunning
    lastExecutionTime
    lastExecutionStatus
  }
}

# 手动触发
mutation {
  manualRunTask(jobId: "data-sync") {
    success
    message
    executionTime
  }
}
```

## 最佳实践

1. **任务命名**：使用有意义的 `jobId` 和 `name`
2. **锁选择**：耗时长或资源密集的任务使用锁，快速任务不用锁
3. **超时设置**：根据任务实际需要设置合理的超时时间
4. **错误处理**：在任务实现中添加适当的错误处理
5. **监控**：定期检查任务执行状态和统计信息

## 注意事项

- 任务 ID 必须唯一
- 带锁任务的超时时间应该大于预期执行时间
- 不要在任务中执行阻塞操作，使用 async/await
- 定期清理不需要的任务统计信息
