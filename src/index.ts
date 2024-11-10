import * as dotenv from 'dotenv';  // 导入 dotenv
dotenv.config();

import cron from 'node-cron';  // 导入 node-cron
import { startDownload } from './service/dailyDownload';
import { consumeDownloadTaskAsync } from './service/consumeService';
import { mongoInitPromise } from './mongo/client';
import { dailySendNewPhoto, sendDailyPhoto } from './service/dailySendPhoto';

// 定义并启动定时任务
(() => {
  const task = cron.schedule('0 10 * * *', () => {
    console.log('Starting download task...');
    startDownload();  // 调用下载任务的逻辑
  });

  // 启动定时任务
  task.start();

  console.log('Cron job scheduled for midnight every day.');
})();

(() => {
  const task = cron.schedule('16 12 * * *', () => {
    console.log('Starting daily sendPhoto...');
    sendDailyPhoto();  // 调用下载任务的逻辑
  });

  // 启动定时任务
  task.start();

  console.log('Cron job scheduled for midnight every day.');
})();

(() => {
  const task = cron.schedule('30 19 * * *', () => {
    console.log('Starting daily sendNewPhoto...');
    dailySendNewPhoto();  // 调用下载任务的逻辑
  });

  // 启动定时任务
  task.start();

  console.log('Cron job scheduled for midnight every day.');
})();

(async () => {
  await mongoInitPromise;  // 等待 MongoDB 初始化完成
  try {
    await consumeDownloadTaskAsync();  // 启动异步任务的消费逻辑
  } catch (err) {
    console.error('Error in the consume download task:', err);
  }
})();