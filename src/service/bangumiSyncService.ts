import { bangumiRequest } from '../api/bangumi';
import { BangumiSubjectCollection } from '../mongo/client';
import { BangumiSubject } from '../mongo/types';
import { send_msg } from '../lark';

interface SubjectQuery {
  type?: 1 | 2 | 3 | 4 | 6;
  limit?: number;
  offset?: number;
}

interface BangumiApiResponse {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

class SlidingWindowRateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    
    // 清理过期的请求记录（滑动窗口）
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // 加一点缓冲
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.wait(); // 递归检查
      }
    }
    
    this.requests.push(now);
  }
}

const apiLimiter = new SlidingWindowRateLimiter(3, 60 * 1000); // 60秒内最多3次

/**
 * 获取指定类型的subject并写入数据库
 * @param type - subject类型
 * @param limit - 每页数量
 * @param offset - 偏移量
 * @returns 返回获取到的subject数量
 */
async function fetchAndStoreSubjects(
  type: 1 | 2 | 3 | 4 | 6,
  limit: number,
  offset: number
): Promise<number> {
  await apiLimiter.wait();
  
  try {
    const response = await bangumiRequest({
      path: '/v0/subjects',
      method: 'GET',
      params: { type, limit, offset }
    }) as BangumiApiResponse;

    if (!response.data || response.data.length === 0) {
      return 0;
    }

    // 转换数据格式并写入数据库
    const subjects: BangumiSubject[] = response.data.map(item => ({
      id: item.id,
      type: item.type,
      name: item.name,
      name_cn: item.name_cn,
      summary: item.summary,
      date: item.date,
      platform: item.platform,
      images: item.images,
      rating: item.rating,
      collection: item.collection,
      tags: item.tags,
      eps: item.eps,
      total_episodes: item.total_episodes,
      volumes: item.volumes,
      locked: item.locked,
      nsfw: item.nsfw,
      series: item.series,
      meta_tags: item.meta_tags,
      infobox: item.infobox,
      created_at: new Date(),
      updated_at: new Date()
    }));

    // 批量插入，如果已存在则更新
    for (const subject of subjects) {
      await BangumiSubjectCollection.updateOne(
        { id: subject.id },
        subject,
        { upsert: true }
      );
    }

    return subjects.length;
  } catch (error) {
    console.error(`Error fetching subjects (type=${type}, offset=${offset}):`, error);
    throw error;
  }
}

/**
 * 同步所有type=2的subject
 * 自动计算total值并分页获取
 * 连续3次失败后终止并发送飞书消息
 */
export async function syncAllAnimeSubjects(): Promise<void> {
  const type = 2 as const;
  const limit = 50;
  let offset = 0;
  let total = 0;
  let consecutiveFailures = 0;
  const maxFailures = 3;

  try {
    // 第一次请求获取total值
    const firstResponse = await bangumiRequest({
      path: '/v0/subjects',
      method: 'GET',
      params: { type, limit, offset }
    }) as BangumiApiResponse;

    total = firstResponse.total;
    console.log(`Total anime subjects to sync: ${total}`);

    // 处理第一页数据
    if (firstResponse.data && firstResponse.data.length > 0) {
      await fetchAndStoreSubjects(type, limit, offset);
      offset += limit;
      consecutiveFailures = 0; // 重置失败计数
    }

    // 循环获取剩余数据
    while (offset < total && consecutiveFailures < maxFailures) {
      try {
        const fetched = await fetchAndStoreSubjects(type, limit, offset);
        if (fetched === 0) {
          console.log('No more data to fetch');
          break;
        }
        
        console.log(`Synced ${offset + fetched}/${total} anime subjects`);
        offset += limit;
        consecutiveFailures = 0; // 重置失败计数
      } catch (error) {
        consecutiveFailures++;
        console.error(`Failed to fetch subjects (attempt ${consecutiveFailures}/${maxFailures}):`, error);
        
        if (consecutiveFailures >= maxFailures) {
          const errorMessage = `Bangumi同步失败：连续${maxFailures}次请求失败，已终止同步。\n失败偏移量：${offset}\n总数量：${total}\n错误信息：${error instanceof Error ? error.message : '未知错误'}`;
          
          // 发送飞书消息
          const chatId = process.env.SELF_CHAT_ID;
          if (chatId) {
            await send_msg(chatId, errorMessage);
            console.log('已发送飞书通知');
          } else {
            console.error('未配置FEISHU_CHAT_ID，无法发送通知');
          }
          
          throw new Error(`连续${maxFailures}次同步失败，已终止`);
        }
        
        // 失败后等待一段时间再重试
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (consecutiveFailures < maxFailures) {
      console.log('All anime subjects synced successfully');
    }
  } catch (error) {
    console.error('Error syncing anime subjects:', error);
    throw error;
  }
}