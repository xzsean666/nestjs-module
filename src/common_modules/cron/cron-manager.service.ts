import { Injectable, Logger } from '@nestjs/common';
import {
  CronJobConfig,
  CronJobStatus,
  CronJobExecutor,
  ManualExecutionResult,
} from './cron-job.interface';
import { DistributedLockService } from '../distributed-lock';

@Injectable()
export class CronManagerService {
  private readonly logger = new Logger(CronManagerService.name);
  private readonly jobs = new Map<string, CronJobExecutor>();
  private readonly jobStates = new Map<string, CronJobStatus>();
  private readonly lockTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly distributedLockService: DistributedLockService,
  ) {}

  /**
   * 注册一个 cron job
   */
  registerJob(executor: CronJobExecutor): void {
    const { jobId, name } = executor.config;

    if (this.jobs.has(jobId)) {
      this.logger.warn(`Job ${jobId} 已存在，将被覆盖`);
    }

    this.jobs.set(jobId, executor);
    this.jobStates.set(jobId, {
      jobId,
      name,
      isRunning: false,
      lastExecutionTime: null,
      executionCount: 0,
      enabled: executor.config.enabled,
    });

    this.logger.log(`已注册 Job: ${name} (${jobId})`);
  }

  /**
   * 注销一个 cron job
   */
  unregisterJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // 如果正在运行，强制停止
    const state = this.jobStates.get(jobId);
    if (state?.isRunning) {
      this.forceStopJob(jobId);
    }

    this.jobs.delete(jobId);
    this.jobStates.delete(jobId);
    this.lockTimeouts.delete(jobId);

    this.logger.log(`已注销 Job: ${job.config.name} (${jobId})`);
    return true;
  }

  /**
   * 执行指定的 job（内部方法，供 @Cron 装饰器调用）
   */
  async executeJob(jobId: string): Promise<void> {
    const executor = this.jobs.get(jobId);
    const state = this.jobStates.get(jobId);

    if (!executor || !state) {
      this.logger.error(`Job ${jobId} 不存在`);
      return;
    }

    if (!state.enabled) {
      this.logger.debug(`Job ${jobId} 已禁用，跳过执行`);
      return;
    }

    // 如果使用锁机制，使用分布式锁
    if (executor.config.useLock) {
      await this.runJobWithDistributedLock(executor);
    } else {
      // 不使用锁，直接执行
      await this.runJobWithOptionalLock(executor);
    }
  }

  /**
   * 使用分布式锁执行任务
   */
  private async runJobWithDistributedLock(
    executor: CronJobExecutor,
  ): Promise<void> {
    const { jobId, name, maxExecutionTime = 30 * 60 * 1000 } = executor.config;

    // this.logger.log(`尝试获取分布式锁执行 Job: ${name} (${jobId})`);

    const result = await this.distributedLockService.executeWithLock(
      {
        lockKey: `cron_job_${jobId}`,
        maxLockTime: maxExecutionTime,
        retryInterval: 5000, // 5秒重试间隔
        maxRetries: 0, // 不重试，如果锁被占用就跳过
      },
      async () => {
        // this.logger.log(`开始执行 Job: ${name} (${jobId})`);
        const startTime = Date.now();
        const state = this.jobStates.get(jobId)!;

        // 更新状态
        state.isRunning = true;
        state.currentExecutionStartTime = startTime;

        try {
          await executor.execute();

          // 更新成功状态
          const executionTime = Date.now() - startTime;
          state.lastExecutionTime = new Date();
          state.executionCount++;
          state.lastExecutionDuration = executionTime;
          state.lastExecutionStatus = 'success';
          state.lastError = undefined;

          // this.logger.log(`Job ${jobId} 执行完成，耗时: ${executionTime}ms`);
          return { success: true, executionTime };
        } catch (error) {
          // 更新错误状态
          const executionTime = Date.now() - startTime;
          state.lastExecutionDuration = executionTime;
          state.lastExecutionStatus = 'error';
          state.lastError =
            error instanceof Error ? error.message : String(error);

          this.logger.error(`Job ${jobId} 执行失败:`, error);
          throw error;
        } finally {
          state.isRunning = false;
          state.currentExecutionStartTime = undefined;
        }
      },
    );

    if (!result.success) {
      if (result.error?.includes('锁被其他进程持有')) {
        this.logger.debug(`Job ${jobId} 跳过执行：${result.error}`);
      } else {
        this.logger.error(`Job ${jobId} 执行失败：${result.error}`);
      }
    }
  }

  /**
   * 带可选锁的任务执行方法（仅内存锁）
   */
  private async runJobWithOptionalLock(
    executor: CronJobExecutor,
  ): Promise<void> {
    const {
      jobId,
      useLock,
      maxExecutionTime = 30 * 60 * 1000,
    } = executor.config;
    const state = this.jobStates.get(jobId)!;
    const startTime = Date.now();

    // 更新状态
    state.isRunning = true;
    state.currentExecutionStartTime = startTime;

    // 如果使用锁，设置超时保护
    let timeout: NodeJS.Timeout | null = null;
    if (useLock) {
      timeout = setTimeout(() => {
        this.logger.error(`Job ${jobId} 执行超时，强制释放锁`);
        this.releaseLock(jobId, 'timeout');
      }, maxExecutionTime);
      this.lockTimeouts.set(jobId, timeout);
    }

    try {
      await executor.execute();

      // 更新成功状态
      const executionTime = Date.now() - startTime;
      state.lastExecutionTime = new Date();
      state.executionCount++;
      state.lastExecutionDuration = executionTime;
      state.lastExecutionStatus = 'success';
      state.lastError = undefined;

      this.logger.log(`Job ${jobId} 执行完成，耗时: ${executionTime}ms`);
    } catch (error) {
      // 更新错误状态
      const executionTime = Date.now() - startTime;
      state.lastExecutionDuration = executionTime;
      state.lastExecutionStatus = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);

      this.logger.error(`Job ${jobId} 执行失败:`, error);
    } finally {
      this.releaseLock(jobId);
    }
  }

  /**
   * 释放锁
   */
  private releaseLock(jobId: string, reason?: 'timeout' | 'complete'): void {
    const state = this.jobStates.get(jobId);
    if (state) {
      state.isRunning = false;
      state.currentExecutionStartTime = undefined;

      if (reason === 'timeout') {
        state.lastExecutionStatus = 'timeout';
      }
    }

    const timeout = this.lockTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.lockTimeouts.delete(jobId);
    }
  }

  /**
   * 手动执行指定 job
   */
  async manualExecuteJob(jobId: string): Promise<ManualExecutionResult> {
    const executor = this.jobs.get(jobId);
    const state = this.jobStates.get(jobId);

    if (!executor || !state) {
      return {
        success: false,
        message: `Job ${jobId} 不存在`,
        jobId,
      };
    }

    if (!state.enabled) {
      return {
        success: false,
        message: `Job ${jobId} 已禁用`,
        jobId,
      };
    }

    if (executor.config.useLock && state.isRunning) {
      return {
        success: false,
        message: `Job ${jobId} 正在执行中，请稍后再试`,
        jobId,
      };
    }

    this.logger.log(`手动触发 Job: ${executor.config.name} (${jobId})`);
    const startTime = Date.now();

    await this.runJobWithOptionalLock(executor);

    const executionTime = Date.now() - startTime;
    return {
      success: true,
      message: `Job ${jobId} 执行完成`,
      executionTime,
      jobId,
    };
  }

  /**
   * 获取指定 job 的状态
   */
  getJobStatus(jobId: string): CronJobStatus | null {
    return this.jobStates.get(jobId) || null;
  }

  /**
   * 获取所有 job 的状态
   */
  getAllJobStatus(): CronJobStatus[] {
    return Array.from(this.jobStates.values());
  }

  /**
   * 启用/禁用指定 job
   */
  setJobEnabled(jobId: string, enabled: boolean): boolean {
    const state = this.jobStates.get(jobId);
    if (!state) {
      return false;
    }

    state.enabled = enabled;
    this.logger.log(`Job ${jobId} 已${enabled ? '启用' : '禁用'}`);
    return true;
  }

  /**
   * 强制停止指定 job
   */
  forceStopJob(jobId: string): { success: boolean; message: string } {
    const state = this.jobStates.get(jobId);

    if (!state) {
      return {
        success: false,
        message: `Job ${jobId} 不存在`,
      };
    }

    if (!state.isRunning) {
      return {
        success: false,
        message: `Job ${jobId} 当前没有在执行`,
      };
    }

    this.logger.warn(`强制停止 Job: ${jobId}`);
    this.releaseLock(jobId);

    return {
      success: true,
      message: `Job ${jobId} 已强制停止`,
    };
  }

  /**
   * 重置指定 job 的统计信息
   */
  resetJobStats(jobId: string): boolean {
    const state = this.jobStates.get(jobId);
    if (!state) {
      return false;
    }

    state.executionCount = 0;
    state.lastExecutionTime = null;
    state.lastExecutionDuration = undefined;
    state.lastExecutionStatus = undefined;
    state.lastError = undefined;

    this.logger.log(`Job ${jobId} 的统计信息已重置`);
    return true;
  }

  /**
   * 重置所有 job 的统计信息
   */
  resetAllStats(): void {
    for (const jobId of this.jobStates.keys()) {
      this.resetJobStats(jobId);
    }
    this.logger.log('所有 Job 的统计信息已重置');
  }
}
