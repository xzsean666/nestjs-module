/**
 * 分布式锁测试示例
 *
 * 这个文件用于测试分布式锁在多进程场景下是否能正确工作
 * 可以同时运行多个进程来验证锁的有效性
 *
 * 使用方法：
 * 1. 在多个终端中同时运行：npx ts-node src/common_modules/distributed-lock/test-lock.example.ts
 * 2. 观察日志输出，应该只有一个进程能获取到锁并执行任务
 */

import { DistributedLockService } from './distributed-lock.service';
import { DBLocalService } from '../../common/db.local.service';

async function testDistributedLock() {
  const dbService = new DBLocalService();
  const lockService = new DistributedLockService(dbService);

  const processId = process.pid;
  const testTaskId = 'test-cron-task';

  console.log(`进程 ${processId} 启动，尝试获取锁...`);

  // 模拟 cron job 执行
  const result = await lockService.executeWithLock(
    {
      lockKey: `cron_job_${testTaskId}`,
      maxLockTime: 10000, // 10秒锁定时间
      retryInterval: 1000, // 1秒重试间隔
      maxRetries: 0, // 不重试，模拟 cron 行为
    },
    async () => {
      console.log(`🔥 进程 ${processId} 成功获取锁，开始执行任务...`);

      // 模拟任务执行
      for (let i = 1; i <= 5; i++) {
        console.log(`📋 进程 ${processId} 正在执行任务 - 步骤 ${i}/5`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`✅ 进程 ${processId} 任务执行完成`);
      return { success: true };
    },
  );

  if (result.success) {
    console.log(`🎉 进程 ${processId} 成功完成任务`);
  } else {
    console.log(`⏭️  进程 ${processId} 跳过执行：${result.error}`);
  }

  // 清理资源
  await dbService.onModuleDestroy();
}

// 运行测试
testDistributedLock().catch(console.error);
