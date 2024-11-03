import Redis from 'ioredis';

const redisUrl = `redis://default:${process.env.REDIS_PASSWORD}@redis:6379`;

const redisClient = new Redis(redisUrl);

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export default redisClient;