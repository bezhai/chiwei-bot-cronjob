#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
dotenv.config();

import { 
  monthlyRotationUpdate, 
  resetRotationMonth, 
  getRotationStatus 
} from '../service/bangumiMonthlyRotationService';
import { mongoInitPromise } from '../mongo/client';

/**
 * 月份轮询管理脚本
 * 用法：
 * - 查看当前状态: npm run rotation:status
 * - 手动执行更新: npm run rotation:run
 * - 重置到指定月份: npm run rotation:reset 3
 */

async function main() {
  await mongoInitPromise;
  
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'status':
        await showStatus();
        break;
      
      case 'run':
        await runUpdate();
        break;
      
      case 'reset':
        if (!arg) {
          console.error('请提供月份参数 (0-12)');
          process.exit(1);
        }
        const month = parseInt(arg, 10);
        if (isNaN(month) || month < 0 || month > 12) {
          console.error('月份必须是 0-12 之间的数字');
          process.exit(1);
        }
        await resetMonth(month);
        break;
      
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

async function showStatus() {
  console.log('=== 月份轮询状态 ===');
  const status = await getRotationStatus();
  console.log(`当前轮询月份: ${status.displayName} (${status.currentMonth})`);
  
  // 显示轮询进度
  const progress = ((status.currentMonth) / 13 * 100).toFixed(1);
  console.log(`轮询进度: ${progress}% (${status.currentMonth}/13)`);
  
  // 显示下一个月份
  const nextMonth = (status.currentMonth + 1) % 13;
  const nextDisplayName = nextMonth === 0 ? '无月份' : `${nextMonth}月`;
  console.log(`下次轮询: ${nextDisplayName} (${nextMonth})`);
}

async function runUpdate() {
  console.log('=== 手动执行月份轮询更新 ===');
  const startTime = Date.now();
  
  await monthlyRotationUpdate();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`更新完成，耗时: ${duration}秒`);
}

async function resetMonth(month: number) {
  console.log(`=== 重置轮询月份到 ${month === 0 ? '无月份' : `${month}月`} ===`);
  
  await resetRotationMonth(month);
  
  console.log('重置成功');
  await showStatus();
}

function showHelp() {
  console.log(`
月份轮询管理脚本

用法:
  npm run rotation:status     - 查看当前轮询状态
  npm run rotation:run        - 手动执行一次轮询更新
  npm run rotation:reset <月份> - 重置轮询到指定月份 (0-12)

示例:
  npm run rotation:status
  npm run rotation:run
  npm run rotation:reset 0    # 重置到无月份
  npm run rotation:reset 6    # 重置到6月

月份说明:
  0  = 无月份 (date字段为空或无效的条目)
  1  = 1月
  2  = 2月
  ...
  12 = 12月
`);
}

if (require.main === module) {
  main();
}