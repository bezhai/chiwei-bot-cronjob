/**
 * Bangumi 模块主入口
 * 导出所有公共接口和功能
 */

// 导出配置管理
export { bangumiConfig, BangumiConfig } from './config';

// 导出类型定义
export * from './types';

// 导出API客户端
export { bangumiApiClient, BangumiApiClient } from './api/client';

// 导出数据服务
export { bangumiDataService, BangumiDataService } from './data/service';

// 导出同步服务
export { subjectSyncService, SubjectSyncService, SubjectSyncResult } from './services/subjectSync';

// 导出策略管理
export { strategyManager, StrategyManager } from './strategies/manager';
export { ISyncStrategy, BaseSyncStrategy } from './strategies/base';

// 导出具体策略
export { DailyIncrementalStrategy } from './strategies/dailyIncremental';
export { YearlyUpdateStrategy } from './strategies/yearlyUpdate';
export { BiweeklyUpdateStrategy } from './strategies/biweeklyUpdate';
export { MonthlyRotationStrategy, getRotationStatus, resetRotationMonth } from './strategies/monthlyRotation';

// 导出工具类
export { RateLimiter, defaultRateLimiter, characterRateLimiter } from './utils/rateLimiter';

/**
 * 执行每日增量更新
 */
export async function dailyIncrementalUpdate() {
  const { strategyManager } = await import('./strategies/manager');
  return strategyManager.executeStrategy('DailyIncremental');
}

/**
 * 执行年度更新
 */
export async function yearlyUpdate() {
  const { strategyManager } = await import('./strategies/manager');
  return strategyManager.executeStrategy('YearlyUpdate');
}

/**
 * 执行双周更新
 */
export async function biweeklyUpdate() {
  const { strategyManager } = await import('./strategies/manager');
  return strategyManager.executeStrategy('BiweeklyUpdate');
}

/**
 * 执行月度轮换更新
 */
export async function monthlyRotationUpdate() {
  const { strategyManager } = await import('./strategies/manager');
  return strategyManager.executeStrategy('MonthlyRotation');
}