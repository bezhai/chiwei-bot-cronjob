# Bangumi 模块架构文档

## 概述

Bangumi 模块经过重构后采用了分层架构设计，提高了代码的可维护性、可扩展性和可配置性。新架构主要包含以下几个层次：

1. **配置层** - 集中管理所有配置
2. **API层** - 统一的API请求处理和限流
3. **服务层** - 业务逻辑处理
4. **策略层** - 可扩展的同步策略
5. **数据层** - 统一的数据访问接口

## 目录结构

```
src/bangumi/
├── index.ts              # 模块主入口
├── config/              # 配置层
│   └── index.ts        # 配置管理器
├── types/               # 类型定义
│   └── index.ts        # 统一的类型定义
├── api/                 # API层
│   └── client.ts       # API客户端
├── services/            # 服务层
│   └── subjectSync.ts  # 条目同步服务
├── strategies/          # 策略层
│   ├── base.ts         # 策略基类和接口
│   ├── manager.ts      # 策略管理器
│   ├── dailyIncremental.ts   # 每日增量策略
│   ├── yearlyUpdate.ts       # 年度更新策略
│   ├── biweeklyUpdate.ts     # 双周更新策略
│   └── monthlyRotation.ts    # 月度轮换策略
├── data/                # 数据层
│   └── service.ts      # 数据访问服务
└── utils/               # 工具类
    └── rateLimiter.ts  # 限流器
```

## 核心组件说明

### 1. 配置管理 (Config)

集中管理所有 Bangumi 相关的配置参数，支持环境变量配置。

```typescript
interface BangumiConfig {
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
    daily: number;
    biweekly: number;
    monthly: number;
    monthlyMin: number;
    monthlyMax: number;
  };
  redis: {
    keyPrefix: string;
    monthlyRotationKey: string;
  };
}
```

### 2. API 客户端 (API Client)

提供统一的 API 请求处理，内置限流机制。

主要功能：
- 自动限流（QPS控制）
- 批量数据获取（生成器模式）
- 错误处理和重试
- 请求拦截器

### 3. 同步策略 (Sync Strategies)

采用策略模式设计，方便扩展新的同步策略。

#### 策略接口

```typescript
interface ISyncStrategy {
  name: string;
  description: string;
  execute(options?: Partial<SyncOptions>): Promise<SyncResult>;
  getProgress(): SyncProgress;
  stop(): void;
  isRunning(): boolean;
}
```

#### 内置策略

1. **DailyIncrementalStrategy** - 每日增量更新
   - 更新最新添加的条目
   - 冷却周期：3天

2. **YearlyUpdateStrategy** - 年度更新
   - 更新当前年份和下一年份的条目
   - 冷却周期：3天

3. **BiweeklyUpdateStrategy** - 双周更新
   - 更新前两年的条目
   - 冷却周期：14天

4. **MonthlyRotationStrategy** - 月度轮换更新
   - 按月份轮换更新条目
   - 冷却周期：60天

### 4. 数据服务 (Data Service)

提供统一的数据库操作接口，包括：
- 条目和角色的CRUD操作
- 统计信息查询
- Redis状态管理
- 批量操作支持

### 5. 限流器 (Rate Limiter)

支持不同QPS的限流控制：
- 默认限流器：10 QPS
- 角色详情限流器：1 QPS
- 支持动态调整QPS

## 使用示例

### 基本使用

```typescript
import { 
  strategyManager, 
  bangumiConfig,
  bangumiDataService 
} from './bangumi';

// 执行每日增量更新
const result = await strategyManager.executeStrategy('DailyIncremental');

// 获取统计信息
const stats = await bangumiDataService.getStatistics();

// 更新配置
bangumiConfig.update({
  rateLimit: {
    defaultQPS: 20,
    characterDetailQPS: 2
  }
});
```

### 扩展新策略

```typescript
import { BaseSyncStrategy } from './bangumi/strategies/base';

export class CustomStrategy extends BaseSyncStrategy {
  name = 'CustomStrategy';
  description = '自定义同步策略';

  protected async doExecute(options?: Partial<SyncOptions>): Promise<void> {
    // 实现具体的同步逻辑
  }
}

// 注册策略
strategyManager.registerStrategy(new CustomStrategy());
```

## 环境变量配置

```bash
# API配置
BANGUMI_API_URL=https://api.bgm.tv
BANGUMI_ACCESS_TOKEN=your_token
BANGUMI_USER_AGENT=your_user_agent
BANGUMI_API_TIMEOUT=15000

# 限流配置
BANGUMI_DEFAULT_QPS=10
BANGUMI_CHARACTER_QPS=1

# 同步配置
BANGUMI_BATCH_SIZE=50
BANGUMI_MAX_RETRIES=3

# 冷却周期配置（天数）
COOLDOWN_DAILY=3
COOLDOWN_BIWEEKLY=14
COOLDOWN_MONTHLY=60
COOLDOWN_MONTHLY_MIN=30
COOLDOWN_MONTHLY_MAX=90
```

## 定时任务配置

在 `src/index.ts` 中配置的定时任务：

- **每日6点**：执行每日增量更新
- **每日7点**：执行年度更新
- **每周日9点**：执行双周更新
- **每周一14点**：执行月度轮换更新
