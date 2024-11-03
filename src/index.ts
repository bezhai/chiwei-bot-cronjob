import * as dotenv from 'dotenv';  // 导入 dotenv
dotenv.config();

import cron from 'node-cron';  // 导入 node-cron
import { startDownload } from './service';
import { consumeDownloadTaskAsync } from './service/consumeService';

// 定义并启动定时任务
(() => {
  const task = cron.schedule('0 8 * * *', () => {
    console.log('Starting download task...');
    startDownload();  // 调用下载任务的逻辑
  });

  // 启动定时任务
  task.start();

  console.log('Cron job scheduled for midnight every day.');
})();

(async () => {
  try {
    await consumeDownloadTaskAsync();  // 启动异步任务的消费逻辑
  } catch (err) {
    console.error('Error in the consume download task:', err);
  }
})();