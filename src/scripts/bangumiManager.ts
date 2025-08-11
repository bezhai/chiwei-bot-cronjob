#!/usr/bin/env ts-node

/**
 * Bangumi 管理脚本
 * 提供命令行工具来管理 Bangumi 同步任务
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mongoInitPromise } from '../mongo/client';
import {
  strategyManager,
  getRotationStatus,
  resetRotationMonth,
  bangumiDataService,
  bangumiConfig
} from '../bangumi';

// 命令处理函数
const commands: Record<string, () => Promise<void>> = {
  // 策略执行命令
  'sync:daily': async () => {
    console.log('执行每日增量更新...');
    const result = await strategyManager.executeStrategy('DailyIncremental');
    console.log('更新结果:', result);
  },

  'sync:yearly': async () => {
    console.log('执行年度更新...');
    const result = await strategyManager.executeStrategy('YearlyUpdate');
    console.log('更新结果:', result);
  },

  'sync:biweekly': async () => {
    console.log('执行双周更新...');
    const result = await strategyManager.executeStrategy('BiweeklyUpdate');
    console.log('更新结果:', result);
  },

  'sync:monthly': async () => {
    console.log('执行月度轮换更新...');
    const result = await strategyManager.executeStrategy('MonthlyRotation');
    console.log('更新结果:', result);
  },

  // 月度轮换管理命令
  'rotation:status': async () => {
    const status = await getRotationStatus();
    console.log('=== 月份轮询状态 ===');
    console.log(`当前月份: ${status.displayName} (${status.currentMonth})`);
    console.log(`下次月份: ${status.nextDisplayName} (${status.nextMonth})`);
    
    const progress = ((status.currentMonth) / 13 * 100).toFixed(1);
    console.log(`轮询进度: ${progress}% (${status.currentMonth}/13)`);
  },

  'rotation:reset': async () => {
    const month = parseInt(process.argv[3], 10);
    if (isNaN(month) || month < 0 || month > 12) {
      console.error('月份必须是 0-12 之间的数字');
      process.exit(1);
    }
    
    await resetRotationMonth(month);
    console.log(`已重置轮询月份到 ${month === 0 ? '无月份' : `${month}月`}`);
  },

  // 统计命令
  'stats': async () => {
    const stats = await bangumiDataService.getStatistics();
    console.log('=== Bangumi 数据统计 ===');
    console.log(`总条目数: ${stats.totalSubjects}`);
    console.log(`总角色数: ${stats.totalCharacters}`);
    console.log('\n条目类型分布:');
    console.log(`  书籍(1): ${stats.subjectsByType[1] || 0}`);
    console.log(`  动画(2): ${stats.subjectsByType[2] || 0}`);
    console.log(`  音乐(3): ${stats.subjectsByType[3] || 0}`);
    console.log(`  游戏(4): ${stats.subjectsByType[4] || 0}`);
    console.log(`  三次元(6): ${stats.subjectsByType[6] || 0}`);
    
    if (stats.lastUpdate) {
      console.log(`\n最后更新时间: ${stats.lastUpdate.toLocaleString()}`);
    }
  },

  // 配置命令
  'config:show': async () => {
    const config = bangumiConfig.get();
    console.log('=== Bangumi 配置 ===');
    console.log(JSON.stringify(config, null, 2));
  },

  // 策略信息命令
  'strategy:list': async () => {
    const strategies = strategyManager.getAllStrategyInfo();
    console.log('=== 可用策略 ===');
    strategies.forEach(strategy => {
      console.log(`\n${strategy.name}:`);
      console.log(`  描述: ${strategy.description}`);
      console.log(`  运行中: ${strategy.isRunning ? '是' : '否'}`);
      if (strategy.isRunning) {
        console.log(`  进度: ${strategy.progress.percentage}% (${strategy.progress.current}/${strategy.progress.total})`);
      }
    });
  },

  'strategy:stop': async () => {
    const strategyName = process.argv[3];
    if (!strategyName) {
      console.error('请提供策略名称');
      process.exit(1);
    }
    
    strategyManager.stopStrategy(strategyName);
    console.log(`已停止策略: ${strategyName}`);
  },

  'strategy:stop-all': async () => {
    strategyManager.stopAllStrategies();
    console.log('已停止所有策略');
  }
};

// 显示帮助信息
function showHelp() {
  console.log(`
Bangumi 管理脚本

用法:
  npm run bangumi <command> [options]

同步命令:
  sync:daily         执行每日增量更新
  sync:yearly        执行年度更新
  sync:biweekly      执行双周更新
  sync:monthly       执行月度轮换更新

月份轮询管理:
  rotation:status    查看当前轮询状态
  rotation:reset <月份>  重置轮询到指定月份 (0-12)

策略管理:
  strategy:list      列出所有策略及状态
  strategy:stop <名称>  停止指定策略
  strategy:stop-all  停止所有策略

其他命令:
  stats             显示数据统计
  config:show       显示当前配置
  help              显示此帮助信息

示例:
  npm run bangumi sync:daily
  npm run bangumi rotation:reset 0
  npm run bangumi stats
`);
}

// 主函数
async function main() {
  await mongoInitPromise;

  const command = process.argv[2];

  if (!command || command === 'help') {
    showHelp();
    process.exit(0);
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`未知命令: ${command}`);
    showHelp();
    process.exit(1);
  }

  try {
    await handler();
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}