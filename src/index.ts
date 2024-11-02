import cron from 'node-cron';  // 导入 node-cron
import { startDownload } from './service';
import * as dotenv from 'dotenv';  // 导入 dotenv
dotenv.config();


// 定义并启动定时任务
(() => {
  const task = cron.schedule('50 0 * * *', () => {
    console.log('Starting download task...');
    startDownload();  // 调用下载任务的逻辑
  });

  // 启动定时任务
  task.start();

  console.log('Cron job scheduled for midnight every day.');
})();