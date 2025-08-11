# chiwei-bot-cronjob

一个基于 Node.js 的自动化定时任务服务，用于管理动漫图片下载、Bangumi 数据同步和飞书消息推送。

## 功能特性

- **Pixiv 图片下载**: 自动下载关注的插画师作品
- **Bangumi 数据同步**: 同步动漫条目信息到本地数据库
- **每日图片推送**: 定时向飞书群聊发送精选图片
- **智能去重**: 避免重复下载和发送相同内容
- **失败重试**: 网络异常时自动重试机制

## 技术架构

- **运行环境**: Node.js 22+  
- **定时任务**: node-cron
- **数据库**: MongoDB + Redis
- **消息推送**: 飞书开放平台 API
- **外部 API**: Pixiv 非官方 API + Bangumi API
- **容器化**: Docker
- **认证**: HTTP 密钥认证

## 快速开始

### 环境准备

1. 克隆项目
```bash
git clone <repository-url>
cd chiwei-bot-cronjob
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
复制示例文件并填写实际配置：
```bash
cp .env.example .env
```

### 本地开发

```bash
# 编译 TypeScript
npm run build

# 直接运行
node dist/index.js

# 或使用 ts-node 开发
npx ts-node src/index.ts
```

### Docker 部署

```bash
# 一键部署：拉取代码、构建镜像、启动容器
make all

# 单独命令
make build    # 构建 Docker 镜像
make run      # 启动容器
make stop     # 停止容器
make clean    # 清理容器和镜像
```

## 定时任务说明

| 时间 | 任务 | 说明 |
|------|------|------|
| 每天 10:00 | Pixiv 图片下载 | 下载关注插画师的最新作品 |
| 每天 18:00 | 每日图片推送 | 向飞书群聊发送精选图片 |
| 每天 19:29 | 新图推送 | 发送当天新发现的优质图片 |
| 每周三 07:00 | Bangumi Archive 同步 | 从 GitHub 下载最新的 Bangumi 数据并导入数据库 |

## 数据结构

### MongoDB 集合

- `img_map`: 已下载的图片元数据
- `download_task`: 待下载的图片任务队列
- `trans_map`: 标签翻译映射
- `bangumi_archive_*`: Bangumi Archive 数据集合（subjects、characters、persons、episodes 等）

### Redis 键值

- `download_user_dict`: 记录每个插画师的最后下载时间
- `ban_illusts`: 黑名单图片 ID 集合

## 开发指南

### 项目结构

```
src/
├── api/           # 外部 API 封装
├── mongo/         # MongoDB 数据层
├── pixiv/         # Pixiv 相关功能
├── redis/         # Redis 客户端
├── service/       # 核心业务逻辑
├── utils/         # 工具函数
└── index.ts       # 入口文件
```

### 添加新任务

1. 在 `src/service/` 创建新的服务文件
2. 在 `src/index.ts` 中添加 cron 调度
3. 更新 README 文档说明

## 故障排查

### 常见问题

1. **连接失败**：检查 MongoDB 和 Redis 服务是否运行
   - MongoDB: 确保 `MONGO_HOST` 可访问，用户名密码正确
   - Redis: 确保 `REDIS_HOST` 可访问，密码配置正确

2. **权限错误**：确认飞书机器人配置正确
   - 检查 `APP_ID` 和 `APP_SECRET` 是否有效
   - 确认 `SELF_CHAT_ID` 是机器人所在群聊的 ID

3. **认证失败**：检查 `HTTP_SECRET` 是否配置正确

4. **Bangumi 同步失败**：确认 `BANGUMI_ACCESS_TOKEN` 有效

### 日志位置

- 本地开发：控制台输出
- Docker 容器：`docker logs chiwei_cronjob`
- 飞书消息：机器人会发送错误通知到配置群聊

## 许可证

MIT License
