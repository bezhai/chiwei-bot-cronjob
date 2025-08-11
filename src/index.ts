import * as dotenv from 'dotenv';  // 导入 dotenv
dotenv.config();

import cron from 'node-cron';  // 导入 node-cron
import { startDownload } from './service/dailyDownload';
import { consumeDownloadTaskAsync } from './service/consumeService';
import { mongoInitPromise } from './mongo/client';
import { dailySendNewPhoto, sendDailyPhoto } from './service/dailySendPhoto';

// 导入新的 bangumi 模块
import {
  dailyIncrementalUpdate,
  yearlyUpdate,
  biweeklyUpdate,
  monthlyRotationUpdate
} from './bangumi';

// 重试配置
const RETRY_DELAYS = [1000, 5000, 15000]; // 重试延迟时间（毫秒）

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 抽象定时任务启动函数
const scheduleTask = (cronTime: string, taskName: string, taskFn: () => Promise<any> | any) => {
  const task = cron.schedule(cronTime, async () => {
    console.log(`Starting ${taskName}...`);
    
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        await Promise.resolve(taskFn()); // 确保能处理同步和异步函数
        console.log(`Successfully completed ${taskName}`);
        break; // 成功执行，跳出重试循环
      } catch (err) {
        const retryDelay = RETRY_DELAYS[attempt];
        
        if (retryDelay === undefined) {
          // 已经用完所有重试次数
          console.error(`Final error in ${taskName} after ${RETRY_DELAYS.length} retries:`, err);
          // 这里可以添加告警通知逻辑
          break;
        }

        console.error(`Error in ${taskName} (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}):`, err);
        console.log(`Retrying ${taskName} in ${retryDelay}ms...`);
        await delay(retryDelay);
      }
    }
  });

  task.start();
  console.log(`Cron job scheduled for ${taskName} at ${cronTime}.`);
};

// 定时任务：下载任务
scheduleTask('0 10 * * *', 'download task', startDownload);

// 定时任务：发送每日照片
scheduleTask('0 18 * * *', 'daily sendPhoto', sendDailyPhoto);

// 定时任务：发送每日新照片
scheduleTask('29 19 * * *', 'daily sendNewPhoto', dailySendNewPhoto);

// 异步消费任务
(async () => {
  await mongoInitPromise;  // 等待 MongoDB 初始化完成
  
  try {
    await consumeDownloadTaskAsync();  // 启动异步任务的消费逻辑
  } catch (err) {
    console.error('Error in the consume download task:', err);
  }
})();

// Bangumi 同步任务（使用新架构）
// 每日6点：增量更新 + 当年和下一年更新
scheduleTask('0 6 * * *', 'daily incremental update', dailyIncrementalUpdate);
scheduleTask('0 7 * * *', 'yearly update', yearlyUpdate);

// 每7天更新：前两年条目更新（每周日9点执行）
scheduleTask('0 9 * * 0', 'biweekly update', biweeklyUpdate);

// 每周一下午2点：月份轮询更新
scheduleTask('0 14 * * 1', 'monthly rotation update', monthlyRotationUpdate);

