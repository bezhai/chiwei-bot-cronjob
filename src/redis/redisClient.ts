import { createClient, RedisClientType } from 'redis';

// 创建 Redis 客户端并提供连接信息，带密码
const client: RedisClientType = createClient({
  url: `redis://default:${process.env.REDIS_PASSWORD}@redis:6379`
});

// 处理连接事件
client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('error', (err: Error) => {
  console.error('Redis connection error:', err);
});

// 连接到 Redis
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

export default client;