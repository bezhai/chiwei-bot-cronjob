/**
 * 同步策略基类和接口定义
 * 支持策略模式扩展
 */

import { SyncOptions, SyncResult, SyncProgress, SubjectType } from '../types';

/**
 * 同步策略接口
 */
export interface ISyncStrategy {
  /**
   * 策略名称
   */
  name: string;

  /**
   * 策略描述
   */
  description: string;

  /**
   * 执行同步
   */
  execute(options?: Partial<SyncOptions>): Promise<SyncResult>;

  /**
   * 获取同步进度
   */
  getProgress(): SyncProgress;

  /**
   * 停止同步
   */
  stop(): void;

  /**
   * 是否正在运行
   */
  isRunning(): boolean;
}

/**
 * 同步策略基类
 */
export abstract class BaseSyncStrategy implements ISyncStrategy {
  abstract name: string;
  abstract description: string;

  protected running = false;
  protected shouldStop = false;
  protected progress: SyncProgress = {
    current: 0,
    total: 0,
    percentage: 0
  };

  protected result: SyncResult = {
    subjectsProcessed: 0,
    charactersProcessed: 0,
    errors: [],
    duration: 0
  };

  /**
   * 执行同步
   */
  async execute(options?: Partial<SyncOptions>): Promise<SyncResult> {
    if (this.running) {
      throw new Error(`Strategy ${this.name} is already running`);
    }

    this.running = true;
    this.shouldStop = false;
    this.resetProgress();
    this.resetResult();

    const startTime = Date.now();

    try {
      console.log(`Starting sync strategy: ${this.name}`);
      await this.doExecute(options);
    } catch (error) {
      console.error(`Error in sync strategy ${this.name}:`, error);
      this.result.errors.push({
        id: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.result.duration = Date.now() - startTime;
      this.running = false;
      console.log(`Sync strategy ${this.name} completed in ${this.result.duration}ms`);
    }

    return this.result;
  }

  /**
   * 具体的执行逻辑（子类实现）
   */
  protected abstract doExecute(options?: Partial<SyncOptions>): Promise<void>;

  /**
   * 获取同步进度
   */
  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  /**
   * 停止同步
   */
  stop(): void {
    console.log(`Stopping sync strategy: ${this.name}`);
    this.shouldStop = true;
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 更新进度
   */
  protected updateProgress(current: number, total: number): void {
    this.progress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0
    };
  }

  /**
   * 重置进度
   */
  protected resetProgress(): void {
    this.progress = {
      current: 0,
      total: 0,
      percentage: 0
    };
  }

  /**
   * 重置结果
   */
  protected resetResult(): void {
    this.result = {
      subjectsProcessed: 0,
      charactersProcessed: 0,
      errors: [],
      duration: 0
    };
  }

  /**
   * 记录错误
   */
  protected recordError(id: number, error: any): void {
    this.result.errors.push({
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  /**
   * 检查是否应该停止
   */
  protected checkShouldStop(): boolean {
    if (this.shouldStop) {
      console.log(`Sync strategy ${this.name} stopped by user`);
      return true;
    }
    return false;
  }
}