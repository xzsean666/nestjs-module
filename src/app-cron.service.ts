import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronManagerService } from './common_modules/cron/cron-manager.service';
import { DistributedLockService } from './common_modules/distributed-lock/distributed-lock.service';
async function runTask() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log('runTask');
}

@Injectable()
export class AppCronService implements OnModuleInit {
  constructor(
    private readonly cronManager: CronManagerService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  onModuleInit() {
    // 注册各种 cron jobs
    this.distributedLockService.clearAllLocks();
    this.registerJobs();
  }

  private registerJobs() {
    // 注册主要任务执行器 - 带锁
    this.cronManager.registerJob({
      config: {
        jobId: 'main-task-runner',
        name: '主要任务执行器',
        useLock: true,
        maxExecutionTime: 30 * 60 * 1000, // 30分钟
        enabled: true,
        description: '执行用户配置的各种任务',
      },
      execute: () => runTask(),
    });
  }

  /**
   * 主要任务执行器 - 每分钟检查一次
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async executeMainTask() {
    // await this.cronManager.executeJob('main-task-runner');
    // await this.cronManager.executeJob('restart-anbox-instance');
  }

  // 公开管理器的方法供外部调用
  getCronManager(): CronManagerService {
    return this.cronManager;
  }
}
