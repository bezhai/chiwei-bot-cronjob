# 月份轮询更新功能

## 概述

月份轮询更新是对原有月度全量刷新的优化改进，将大量数据的更新分散到13周内完成，避免单次更新对系统造成过大压力。

## 设计理念

### 问题背景
- 原有的月度全量刷新会在短时间内处理大量数据
- API调用频率过高，容易触发限制
- 系统资源消耗集中，影响其他任务

### 解决方案
- 将全量更新按月份分散到13个轮询周期
- 每周执行一次，一个季度完成一轮完整更新
- 使用Redis记录轮询状态，支持断点续传

## 技术实现

### 轮询策略

#### 1. 有月份条目 (1-12月)
```typescript
// 使用API的month参数筛选
GET /v0/subjects?type=2&month=6&limit=50&offset=0
```

#### 2. 无月份条目 (month=0)
```typescript
// 从本地数据库筛选
const subjects = await BangumiSubjectCollection.find({
  type: 2,
  $or: [
    { date: { $exists: false } },
    { date: { $type: "null" } },
    { date: "" },
    { date: { $regex: /^(?!(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|\d{4})).*$/ } }
  ]
});

// 使用单条目API更新
GET /v0/subjects/{id}
```

### 状态管理

#### Redis键值
- **键名**: `bangumi:monthly_rotation:current_month`
- **值**: `0-12` (0=无月份, 1-12=对应月份)
- **自动轮询**: 每次执行后自动切换到下一个月份

#### 轮询周期
```
第1周: 1月   → 第2周: 2月   → 第3周: 3月   → 第4周: 4月
第5周: 5月   → 第6周: 6月   → 第7周: 7月   → 第8周: 8月  
第9周: 9月   → 第10周: 10月 → 第11周: 11月 → 第12周: 12月
第13周: 无月份 → 第14周: 1月 (新一轮开始)
```

### 限流控制

#### API调用限制
- **频率**: 严格1 QPS
- **实现**: `RateLimiter` 类控制请求间隔
- **适用**: 所有API调用（条目详情、角色信息）

#### 角色更新冷却
- **冷却周期**: 60天
- **检查机制**: `shouldUpdateCharacterWithCooldown()`
- **目的**: 避免频繁更新同一角色

## 定时任务配置

### 主要任务
```typescript
// 每周一下午2点执行月份轮询更新
scheduleTask('0 14 * * 1', 'monthly rotation update', monthlyRotationUpdate);
```

### 备用任务
```typescript
// 每季度全量刷新（作为备用）
scheduleTask('0 11 1 */3 *', 'quarterly full refresh', monthlyFullRefresh);
```

## 管理工具

### 命令行脚本

#### 查看当前状态
```bash
npm run rotation:status
```
输出示例：
```
=== 月份轮询状态 ===
当前轮询月份: 6月 (6)
轮询进度: 46.2% (6/13)
下次轮询: 7月 (7)
```

#### 手动执行更新
```bash
npm run rotation:run
```

#### 重置轮询月份
```bash
# 重置到6月
npm run rotation:reset 6

# 重置到无月份
npm run rotation:reset 0
```

### 编程接口

```typescript
import { 
  monthlyRotationUpdate,
  getRotationStatus,
  resetRotationMonth 
} from '../service/bangumiMonthlyRotationService';

// 执行轮询更新
await monthlyRotationUpdate();

// 获取当前状态
const status = await getRotationStatus();
console.log(`当前月份: ${status.displayName}`);

// 重置到指定月份
await resetRotationMonth(3); // 重置到3月
```

## 监控与日志

### 关键日志
```
Starting monthly rotation update...
Current rotation month: 6月 (6)
Fetching subjects for month 6 from API...
Successfully updated subject 12345 (某动画名称)
Updated rotation month from 6 to 7
Monthly rotation update completed
```

### 错误处理
- **API调用失败**: 记录错误但继续处理其他条目
- **Redis连接失败**: 使用默认值继续执行
- **数据库错误**: 跳过有问题的条目

## 性能优化

### 相比原方案的优势

1. **分散负载**: 将大量数据分散到13周处理
2. **降低峰值**: 避免单次处理过多数据
3. **提高稳定性**: 单个条目失败不影响整体进度
4. **便于监控**: 每周执行，便于观察和调试

### 资源消耗对比

| 指标 | 原月度全量刷新 | 新月份轮询 |
|------|----------------|------------|
| 单次执行时间 | 数小时 | 30分钟-2小时 |
| API调用峰值 | 极高 | 平稳1 QPS |
| 内存占用 | 高 | 低 |
| 系统负载 | 集中高负载 | 分散低负载 |

## 故障恢复

### 中断恢复
- Redis记录当前轮询状态，支持断点续传
- 下次执行时从中断的月份继续

### 数据一致性
- 每个条目独立更新，失败不影响其他条目
- 季度全量刷新作为备用，确保数据完整性

### 手动干预
- 支持手动重置轮询状态
- 支持手动触发更新
- 支持跳过特定月份（通过重置实现）

## 最佳实践

### 部署建议
1. 确保Redis服务稳定运行
2. 监控API调用频率，避免超限
3. 定期检查轮询状态，确保正常轮转
4. 关注日志输出，及时发现问题

### 维护建议
1. 每季度检查一次轮询完整性
2. 监控各月份的数据更新情况
3. 根据实际情况调整冷却周期
4. 定期清理Redis中的过期数据

## 未来扩展

### 可能的改进方向
1. **动态调整**: 根据数据量动态调整轮询频率
2. **智能跳过**: 跳过没有数据的月份
3. **并行处理**: 在保证QPS限制下适度并行
4. **统计分析**: 收集各月份的更新统计数据