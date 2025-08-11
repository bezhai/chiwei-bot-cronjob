/**
 * 限流管理器
 * 提供统一的 QPS 限流功能
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private interval: number;
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(qps: number) {
    this.interval = 1000 / qps; // QPS转换为毫秒间隔
  }

  /**
   * 执行限流
   * @returns Promise<void>
   */
  async limit(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.interval) {
        const waitTime = this.interval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }

      this.lastRequestTime = Date.now();
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 更新 QPS 限制
   * @param qps 新的 QPS 值
   */
  updateQPS(qps: number): void {
    this.interval = 1000 / qps;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

// 创建全局限流器实例
export const defaultRateLimiter = new RateLimiter(10); // 默认 10 QPS
export const characterRateLimiter = new RateLimiter(1); // 角色详情 1 QPS