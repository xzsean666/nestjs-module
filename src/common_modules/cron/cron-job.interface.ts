export interface CronJobConfig {
  /** Job 唯一标识 */
  jobId: string;
  /** Job 名称 */
  name: string;
  /** 是否启用锁机制 */
  useLock: boolean;
  /** 最大执行时间（毫秒），仅在使用锁时生效 */
  maxExecutionTime?: number;
  /** 是否启用 */
  enabled: boolean;
  /** 描述 */
  description?: string;
}

export interface CronJobStatus {
  /** Job ID */
  jobId: string;
  /** Job 名称 */
  name: string;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 最后执行时间 */
  lastExecutionTime: Date | null;
  /** 执行次数 */
  executionCount: number;
  /** 是否启用 */
  enabled: boolean;
  /** 当前执行开始时间（仅在运行时有值） */
  currentExecutionStartTime?: number;
  /** 最后执行耗时（毫秒） */
  lastExecutionDuration?: number;
  /** 最后执行状态 */
  lastExecutionStatus?: 'success' | 'error' | 'timeout';
  /** 最后错误信息 */
  lastError?: string;
}

export interface CronJobExecutor {
  /** Job 配置 */
  config: CronJobConfig;
  /** 执行函数 */
  execute: () => Promise<void>;
}

export interface ManualExecutionResult {
  success: boolean;
  message: string;
  executionTime?: number;
  jobId: string;
}
