/**
 * Bangumi 配置管理模块
 * 集中管理所有 Bangumi 相关的配置参数
 */

export interface BangumiConfig {
  api: {
    baseUrl: string;
    accessToken?: string;
    userAgent: string;
    timeout: number;
  };
  
  rateLimit: {
    defaultQPS: number;
    characterDetailQPS: number;
  };
  
  sync: {
    batchSize: number;
    maxRetries: number;
  };
  
  cooldown: {
    daily: number;        // 每日更新冷却天数
    biweekly: number;     // 双周更新冷却天数
    monthly: number;      // 月度更新冷却天数
    monthlyMin: number;   // 月度更新最小冷却天数
    monthlyMax: number;   // 月度更新最大冷却天数
  };
  
  redis: {
    keyPrefix: string;
    monthlyRotationKey: string;
  };
}

// 默认配置
const defaultConfig: BangumiConfig = {
  api: {
    baseUrl: process.env.BANGUMI_API_URL || 'https://api.bgm.tv',
    accessToken: process.env.BANGUMI_ACCESS_TOKEN,
    userAgent: process.env.BANGUMI_USER_AGENT || 'panda1234/search',
    timeout: parseInt(process.env.BANGUMI_API_TIMEOUT || '15000', 10)
  },
  
  rateLimit: {
    defaultQPS: parseInt(process.env.BANGUMI_DEFAULT_QPS || '10', 10),
    characterDetailQPS: parseInt(process.env.BANGUMI_CHARACTER_QPS || '1', 10)
  },
  
  sync: {
    batchSize: parseInt(process.env.BANGUMI_BATCH_SIZE || '50', 10),
    maxRetries: parseInt(process.env.BANGUMI_MAX_RETRIES || '3', 10)
  },
  
  cooldown: {
    daily: parseInt(process.env.COOLDOWN_DAILY || '3', 10),
    biweekly: parseInt(process.env.COOLDOWN_BIWEEKLY || '14', 10),
    monthly: parseInt(process.env.COOLDOWN_MONTHLY || '60', 10),
    monthlyMin: parseInt(process.env.COOLDOWN_MONTHLY_MIN || '30', 10),
    monthlyMax: parseInt(process.env.COOLDOWN_MONTHLY_MAX || '90', 10)
  },
  
  redis: {
    keyPrefix: 'bangumi:',
    monthlyRotationKey: 'bangumi:monthly_rotation:current_month'
  }
};

// 配置单例
class ConfigManager {
  private config: BangumiConfig;
  
  constructor() {
    this.config = { ...defaultConfig };
  }
  
  /**
   * 获取配置
   */
  get(): BangumiConfig {
    return this.config;
  }
  
  /**
   * 更新配置（用于测试或运行时调整）
   */
  update(updates: Partial<BangumiConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }
  
  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = { ...defaultConfig };
  }
}

export const bangumiConfig = new ConfigManager();