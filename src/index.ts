import * as dotenv from 'dotenv';  // 导入 dotenv
dotenv.config();

import cron from 'node-cron';  // 导入 node-cron
import { startDownload } from './service/dailyDownload';
import { consumeDownloadTaskAsync } from './service/consumeService';
import { mongoInitPromise } from './mongo/client';
import { dailySendNewPhoto, sendDailyPhoto } from './service/dailySendPhoto';

// 抽象定时任务启动函数
const scheduleTask = (cronTime: string, taskName: string, taskFn: () => void) => {
  const task = cron.schedule(cronTime, () => {
    console.log(`Starting ${taskName}...`);
    taskFn();
  });

  task.start();
  console.log(`Cron job scheduled for ${taskName} at ${cronTime}.`);
};

// 定时任务：下载任务
scheduleTask('16 13 * * *', 'download task', startDownload);

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