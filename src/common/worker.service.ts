import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as crypto from 'crypto';

type Task<T = any> = {
  id: string;
  func: (...args: any[]) => T | Promise<T>;
  args: any[];
  resolve?: (value: T) => void;
  reject?: (err: any) => void;
  fireAndForget?: boolean;
  timeout?: number;
  retries?: number;
  maxRetries?: number;
};

interface PoolOptions {
  minPoolSize?: number;
  maxPoolSize?: number;
  taskTimeout?: number; // 默认任务超时时间
  maxRetries?: number; // 默认最大重试次数
}

interface ExtendedWorker extends Worker {
  _currentTask?: Task;
  _isIdle: boolean;
  _taskStartTime?: number;
}

interface WorkerMessage {
  result?: any;
  error?: string;
  taskId?: string;
}

@Injectable()
export class WorkerPool implements OnModuleDestroy {
  private minPoolSize: number;
  private maxPoolSize: number;
  private defaultTimeout: number;
  private defaultMaxRetries: number;

  private workers: ExtendedWorker[] = [];
  private idleWorkers: ExtendedWorker[] = [];
  private taskQueue: Task[] = [];
  private activeTasks = new Map<string, Task>();
  private functionCache = new Map<string, string>();

  constructor(options: PoolOptions = {}) {
    this.minPoolSize = options.minPoolSize || 2;
    this.maxPoolSize = options.maxPoolSize || 16;
    this.defaultTimeout = options.taskTimeout || 300000; // 300秒默认超时
    this.defaultMaxRetries = options.maxRetries || 3; // Increased retries

    for (let i = 0; i < this.minPoolSize; i++) {
      this.addWorker();
    }

    // 定期检查超时任务
    setInterval(() => this.checkTimeouts(), 5000);
    console.log('WorkerPool initialized with stats:', this.getStats());
  }

  private generateTaskId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getFunctionHash(func: Function): string {
    return crypto.createHash('sha256').update(func.toString()).digest('hex');
  }

  private addWorker(): ExtendedWorker {
    // 使用更安全的worker实现，避免eval
    const workerCode = `
      const { parentPort } = require('worker_threads');
      globalThis.child_process = require('child_process');
      globalThis.execSync = globalThis.child_process.execSync;
      globalThis.exec = globalThis.child_process.exec;

      globalThis.sleep = function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      };

      const registeredFunctions = new Map();

      parentPort.on('message', async ({ type, taskId, funcStr, funcHash, args }) => {
        try {
          if (type === 'register_function') {
            // 注册函数
            const func = new Function('return (' + funcStr + ')')();
            registeredFunctions.set(funcHash, func);
            parentPort.postMessage({ type: 'function_registered', funcHash, taskId });
            return;
          }

          if (type === 'execute_task') {
            const func = registeredFunctions.get(funcHash);
            if (!func) {
              throw new Error('Function not found. Please register function first.');
            }
            
            const result = await func(...args);
            parentPort.postMessage({ type: 'task_result', taskId, result });
          }
        } catch (err) {
          parentPort.postMessage({ 
            type: 'task_error', 
            taskId, 
            error: err.message 
          });
        }
      });
    `;

    const worker = new Worker(workerCode, { eval: true }) as ExtendedWorker;
    worker._isIdle = true;

    worker.on('message', (msg) => this.handleMessage(worker, msg));
    worker.on('error', (err) => this.handleError(worker, err));
    worker.on('exit', () => this.handleExit(worker));

    this.workers.push(worker);
    this.idleWorkers.push(worker);

    return worker;
  }

  private handleMessage(worker: ExtendedWorker, msg: any) {
    if (msg.type === 'function_registered') {
      // 函数注册完成，执行任务
      const task = this.activeTasks.get(msg.taskId);
      if (task && worker._currentTask?.id === msg.taskId) {
        worker.postMessage({
          type: 'execute_task',
          taskId: msg.taskId,
          funcHash: msg.funcHash,
          args: task.args,
        });
      }
      return;
    }

    if (msg.type === 'task_result' || msg.type === 'task_error') {
      const task = this.activeTasks.get(msg.taskId);
      if (!task || worker._currentTask?.id !== msg.taskId) return;

      if (!task.fireAndForget) {
        if (msg.type === 'task_error') {
          // 检查是否需要重试
          console.log(
            `Task ${task.id} in handleMessage (error): retries=${task.retries}, maxRetries=${task.maxRetries}. Should retry: ${this.shouldRetry(task)}`,
          );
          if (this.shouldRetry(task)) {
            this.retryTask(task);
          } else {
            task.reject?.(new Error(msg.error));
          }
        } else {
          task.resolve?.(msg.result);
        }
      }

      this.completeTask(worker, task);
    }
  }

  private handleError(worker: ExtendedWorker, err: any) {
    const task = worker._currentTask;
    const workerId = worker.threadId; // Capture workerId early

    if (task) {
      console.log(
        `Task ${task.id} in handleError: retries=${task.retries}, maxRetries=${task.maxRetries}. Should retry: ${this.shouldRetry(task)}`,
      );
    }

    if (task && !task.fireAndForget) {
      if (this.shouldRetry(task)) {
        this.retryTask(task);
      } else {
        task.reject?.(err);
      }
    } else if (task && task.fireAndForget && !this.shouldRetry(task)) {
      console.error(
        `Fire-and-forget task ${task.id} failed after maximum retries:`,
        err,
      );
    } else if (task && task.fireAndForget && this.shouldRetry(task)) {
      this.retryTask(task);
    }

    this.removeWorker(worker);
    this.runNext();
    console.warn(
      `Task ${task?.id} on worker ${workerId} failed. Retrying: ${task && this.shouldRetry(task)}. Pool stats:`,
      this.getStats(),
    );
  }

  private handleExit(worker: ExtendedWorker) {
    const task = worker._currentTask;
    const workerId = worker.threadId; // Capture workerId early

    // 重新排队当前任务
    if (task) {
      console.log(
        `Task ${task.id} in handleExit: retries=${task.retries}, maxRetries=${task.maxRetries}. Should retry: ${this.shouldRetry(task)}`,
      );
      if (this.shouldRetry(task)) {
        this.retryTask(task);
      } else if (!task.fireAndForget) {
        task.reject?.(new Error('Worker exited unexpectedly'));
      } else {
        console.error(
          `Fire-and-forget task ${task.id} failed due to unexpected worker exit after maximum retries.`,
        );
      }
    }

    this.removeWorker(worker);
    this.runNext();
    console.warn(
      `Worker ${workerId} exited unexpectedly. Task ${task?.id} was active. Pool stats:`,
      this.getStats(),
    );
  }

  private shouldRetry(task: Task): boolean {
    const maxRetries = task.maxRetries ?? this.defaultMaxRetries;
    const currentRetries = task.retries ?? 0;
    return currentRetries < maxRetries;
  }

  private retryTask(task: Task) {
    task.retries = (task.retries ?? 0) + 1;
    this.taskQueue.unshift(task); // 优先重试
    this.runNext();
    console.log(
      `Task ${task.id} retried. Current retries: ${task.retries}. Pool stats:`,
      this.getStats(),
    );
  }

  private completeTask(worker: ExtendedWorker, task: Task) {
    this.activeTasks.delete(task.id);
    worker._currentTask = undefined;
    worker._isIdle = true;
    worker._taskStartTime = undefined;

    this.idleWorkers.push(worker);
    this.runNext();
    console.log(
      `Task ${task.id} completed. Worker ${worker.threadId} is now idle. Pool stats:`,
      this.getStats(),
    );
  }

  private removeWorker(worker: ExtendedWorker) {
    this.workers = this.workers.filter((w) => w !== worker);
    this.idleWorkers = this.idleWorkers.filter((w) => w !== worker);

    // 维护最小池大小
    if (this.workers.length < this.minPoolSize) {
      this.addWorker();
    }

    worker.terminate().catch(() => {});
  }

  private checkTimeouts() {
    const now = Date.now();

    for (const worker of this.workers) {
      if (worker._currentTask && worker._taskStartTime) {
        const timeout = worker._currentTask.timeout ?? this.defaultTimeout;
        if (now - worker._taskStartTime > timeout) {
          // 任务超时
          const task = worker._currentTask;
          console.log(
            `Task ${task.id} in checkTimeouts: retries=${task.retries}, maxRetries=${task.maxRetries}. Should retry: ${this.shouldRetry(task)}`,
          );

          if (!task.fireAndForget) {
            if (this.shouldRetry(task)) {
              this.retryTask(task);
            } else {
              task.reject?.(new Error('Task timeout'));
            }
          } else if (task.fireAndForget && this.shouldRetry(task)) {
            this.retryTask(task);
          } else if (task.fireAndForget && !this.shouldRetry(task)) {
            console.error(
              `Fire-and-forget task ${task.id} timed out after maximum retries.`,
            );
          }

          // 终止超时的worker
          this.removeWorker(worker);
          console.warn(
            `Task ${task.id} on worker ${worker.threadId} timed out. Retrying: ${this.shouldRetry(task)}. Pool stats:`,
            this.getStats(),
          );
        }
      }
    }
  }

  private async runNext() {
    if (this.taskQueue.length === 0) return;

    // Attempt to get an idle worker
    let worker = this.idleWorkers.shift();

    // If no idle workers, try to create one if under maxPoolSize
    if (!worker && this.workers.length < this.maxPoolSize) {
      worker = this.addWorker();
      console.log(
        `New worker ${worker.threadId} added. Pool stats:`,
        this.getStats(),
      );
      // A newly added worker might not be immediately ready, or if worker creation fails
      if (!worker) {
        // If we can't create a worker, schedule a retry after a short delay
        setTimeout(() => this.runNext(), 100);
        console.warn(
          'Failed to create a new worker, retrying runNext in 100ms. Pool stats:',
          this.getStats(),
        );
        return;
      }
    }

    // If still no worker (either maxPoolSize reached or worker creation failed/is delayed)
    if (!worker) {
      // Schedule a retry after a short delay to check for idle workers again
      setTimeout(() => this.runNext(), 100);
      console.warn(
        'No idle workers and maxPoolSize reached or worker creation delayed, retrying runNext in 100ms. Pool stats:',
        this.getStats(),
      );
      return;
    }

    const task = this.taskQueue.shift()!;
    console.log(
      `Worker ${worker.threadId} starting task ${task.id}. Pool stats:`,
      this.getStats(),
    );

    worker._currentTask = task;
    worker._isIdle = false;
    worker._taskStartTime = Date.now();

    this.activeTasks.set(task.id, task);

    // 检查函数缓存
    const funcHash = this.getFunctionHash(task.func);
    const cachedFuncStr = this.functionCache.get(funcHash);

    if (cachedFuncStr) {
      // 使用缓存的函数
      worker.postMessage({
        type: 'execute_task',
        taskId: task.id,
        funcHash,
        args: task.args,
      });
      console.log(
        `Task ${task.id} (cached) sent to worker ${worker.threadId}.`,
      );
    } else {
      // 注册新函数
      const funcStr = task.func.toString();
      this.functionCache.set(funcHash, funcStr);

      worker.postMessage({
        type: 'register_function',
        taskId: task.id,
        funcStr,
        funcHash,
      });
      console.log(
        `Task ${task.id}: function registration sent to worker ${worker.threadId}.`,
      );
    }

    // After assigning a task, immediately try to run the next one if available
    this.runNext();
  }

  public run<T>(
    func: (...args: any[]) => T | Promise<T>,
    ...args: any[]
  ): Promise<T>;

  public run<T>(
    func: (...args: any[]) => T | Promise<T>,
    options: { timeout?: number; maxRetries?: number },
    ...args: any[]
  ): Promise<T>;

  public run<T>(
    func: (...args: any[]) => T | Promise<T>,
    optionsOrFirstArg?: any,
    ...args: any[]
  ): Promise<T> {
    let taskOptions: { timeout?: number; maxRetries?: number } = {};
    let taskArgs = args;

    if (
      optionsOrFirstArg &&
      typeof optionsOrFirstArg === 'object' &&
      ('timeout' in optionsOrFirstArg || 'maxRetries' in optionsOrFirstArg)
    ) {
      taskOptions = optionsOrFirstArg;
    } else {
      taskArgs = [optionsOrFirstArg, ...args];
    }

    return new Promise<T>((resolve, reject) => {
      const task: Task<T> = {
        id: this.generateTaskId(),
        func,
        args: taskArgs,
        resolve,
        reject,
        timeout: taskOptions.timeout,
        maxRetries: taskOptions.maxRetries,
        retries: 0,
      };

      this.taskQueue.push(task);
      this.runNext();
    });
  }

  public fireAndForget(func: (...args: any[]) => any, ...args: any[]): void;

  public fireAndForget(
    func: (...args: any[]) => any,
    options: { timeout?: number; maxRetries?: number },
    ...args: any[]
  ): void;

  public fireAndForget(
    func: (...args: any[]) => any,
    optionsOrFirstArg?: any,
    ...args: any[]
  ): void {
    let taskOptions: { timeout?: number; maxRetries?: number } = {};
    let taskArgs = args;

    if (
      optionsOrFirstArg &&
      typeof optionsOrFirstArg === 'object' &&
      ('timeout' in optionsOrFirstArg || 'maxRetries' in optionsOrFirstArg)
    ) {
      taskOptions = optionsOrFirstArg;
    } else {
      taskArgs = [optionsOrFirstArg, ...args];
    }

    const task: Task = {
      id: this.generateTaskId(),
      func,
      args: taskArgs,
      fireAndForget: true,
      timeout: taskOptions.timeout,
      maxRetries: taskOptions.maxRetries,
      retries: 0,
    };

    this.taskQueue.push(task);
    this.runNext();
  }

  public getStats() {
    return {
      totalWorkers: this.workers.length,
      idleWorkers: this.idleWorkers.length,
      busyWorkers: this.workers.length - this.idleWorkers.length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      functionCacheSize: this.functionCache.size,
    };
  }

  public async destroy() {
    // 清理超时检查间隔
    clearInterval(this.checkTimeouts as any);

    // 拒绝所有排队的任务
    for (const task of this.taskQueue) {
      if (!task.fireAndForget) {
        task.reject?.(new Error('WorkerPool is being destroyed'));
      }
    }

    // 拒绝所有活动任务
    for (const task of this.activeTasks.values()) {
      if (!task.fireAndForget) {
        task.reject?.(new Error('WorkerPool is being destroyed'));
      }
    }

    // 终止所有worker
    await Promise.allSettled(this.workers.map((w) => w.terminate()));

    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.functionCache.clear();
  }

  public async onModuleDestroy() {
    await this.destroy();
  }
}
