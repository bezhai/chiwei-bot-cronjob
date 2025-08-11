/**
 * 同步策略管理器
 * 统一管理和调度所有同步策略
 */

import { ISyncStrategy } from './base';
import { DailyIncrementalStrategy } from './dailyIncremental';
import { YearlyUpdateStrategy } from './yearlyUpdate';
import { BiweeklyUpdateStrategy } from './biweeklyUpdate';
import { MonthlyRotationStrategy } from './monthlyRotation';
import { SyncOptions, SyncResult } from '../types';

export class StrategyManager {
  private strategies: Map<string, ISyncStrategy> = new Map();
  private runningStrategies: Set<string> = new Set();

  constructor() {
    // 注册所有策略
    this.registerStrategy(new DailyIncrementalStrategy());
    this.registerStrategy(new YearlyUpdateStrategy());
    this.registerStrategy(new BiweeklyUpdateStrategy());
    this.registerStrategy(new MonthlyRotationStrategy());
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: ISyncStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`Registered strategy: ${strategy.name}`);
  }

  /**
   * 获取策略
   */
  getStrategy(name: string): ISyncStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * 获取所有策略
   */
  getAllStrategies(): ISyncStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 执行策略
   */
  async executeStrategy(
    name: string,
    options?: Partial<SyncOptions>
  ): Promise<SyncResult> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Strategy ${name} not found`);
    }

    if (this.runningStrategies.has(name)) {
      throw new Error(`Strategy ${name} is already running`);
    }

    this.runningStrategies.add(name);

    try {
      const result = await strategy.execute(options);
      return result;
    } finally {
      this.runningStrategies.delete(name);
    }
  }

  /**
   * 停止策略
   */
  stopStrategy(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.stop();
    }
  }

  /**
   * 获取策略进度
   */
  getStrategyProgress(name: string) {
    const strategy = this.strategies.get(name);
    if (strategy) {
      return strategy.getProgress();
    }
    return null;
  }

  /**
   * 获取正在运行的策略
   */
  getRunningStrategies(): string[] {
    return Array.from(this.runningStrategies);
  }

  /**
   * 检查策略是否正在运行
   */
  isStrategyRunning(name: string): boolean {
    return this.runningStrategies.has(name);
  }

  /**
   * 停止所有策略
   */
  stopAllStrategies(): void {
    for (const [name, strategy] of this.strategies) {
      if (strategy.isRunning()) {
        console.log(`Stopping strategy: ${name}`);
        strategy.stop();
      }
    }
  }

  /**
   * 获取策略信息
   */
  getStrategyInfo(name: string) {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      return null;
    }

    return {
      name: strategy.name,
      description: strategy.description,
      isRunning: strategy.isRunning(),
      progress: strategy.getProgress()
    };
  }

  /**
   * 获取所有策略信息
   */
  getAllStrategyInfo() {
    return Array.from(this.strategies.values()).map(strategy => ({
      name: strategy.name,
      description: strategy.description,
      isRunning: strategy.isRunning(),
      progress: strategy.getProgress()
    }));
  }
}

// 导出单例
export const strategyManager = new StrategyManager();