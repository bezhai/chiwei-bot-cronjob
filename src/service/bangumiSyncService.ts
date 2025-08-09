import { bangumiRequest } from '../api/bangumi';
import { BangumiSubjectCollection } from '../mongo/client';
import { BangumiSubject, SubjectCharacter } from '../mongo/types';
import { send_msg } from '../lark';
import { getSubjectCharacters, getCharacterDetail, RelatedCharacter } from './bangumiService';
import {
  shouldUpdateCharacter,
  upsertCharacter,
  updateSubjectCharacters
} from '../mongo/service';

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
  private mutex: Promise<void> = Promise.resolve();

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async wait(): Promise<void> {
    // 使用互斥锁确保并发安全
    this.mutex = this.mutex.then(async () => {
      const now = Date.now();
      
      // 清理过期的请求记录（滑动窗口）
      this.requests = this.requests.filter(time => now - time < this.windowMs);
      
      if (this.requests.length >= this.maxRequests) {
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (now - oldestRequest) + 100; // 加一点缓冲
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          // 重新检查（递归调用会重新获取锁）
          return this.wait();
        }
      }
      
      this.requests.push(now);
    });
    
    await this.mutex;
  }
}

/**
 * 信号量并发控制器
 * 用于控制并发请求数量
 */
class Semaphore {
  private permits: number;
  private readonly maxPermits: number;
  private queue: (() => void)[] = [];

  constructor(maxPermits: number) {
    this.maxPermits = maxPermits;
    this.permits = maxPermits;
  }

  /**
   * 获取一个许可，如果当前没有可用许可则等待
   */
  async acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  /**
   * 释放一个许可，让等待的下一个请求获得许可
   */
  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      if (resolve) resolve();
    } else {
      this.permits++;
    }
  }
}

const apiLimiter = new SlidingWindowRateLimiter(3, 60 * 1000); // 60秒内最多3次
const concurrencyLimiter = new Semaphore(3); // 最多3个并发请求

/**
 * 同步单个条目的角色信息
 * @param subjectId - 条目ID
 */
async function syncSubjectCharacters(subjectId: number): Promise<void> {
  await apiLimiter.wait();
  
  try {
    console.log(`Syncing characters for subject ${subjectId}...`);
    
    // 获取条目关联的角色列表
    const relatedCharacters: RelatedCharacter[] = await getSubjectCharacters(subjectId);
    
    if (!relatedCharacters || relatedCharacters.length === 0) {
      console.log(`No characters found for subject ${subjectId}`);
      return;
    }

    // 转换为SubjectCharacter格式
    const subjectCharacters: SubjectCharacter[] = relatedCharacters.map(char => ({
      id: char.id,
      name: char.name,
      relation: char.relation
    }));

    // 更新subject的角色列表
    await updateSubjectCharacters(subjectId, subjectCharacters);

    // 优雅并发处理：预检查 + 信号量控制
    const charactersToUpdate: RelatedCharacter[] = [];
    
    // 先串行检查哪些角色需要更新（这个步骤无法并行，因为需要数据库查询）
    for (const character of relatedCharacters) {
      try {
        const needsUpdate = await shouldUpdateCharacter(character.id);
        if (needsUpdate) {
          charactersToUpdate.push(character);
        } else {
          console.log(`Character ${character.id} (${character.name}) is up to date, skipping...`);
        }
      } catch (error) {
        console.error(`Failed to check character ${character.id}:`, error);
      }
    }

    if (charactersToUpdate.length === 0) {
      console.log(`All characters for subject ${subjectId} are up to date`);
      return;
    }

    console.log(`Need to update ${charactersToUpdate.length} characters for subject ${subjectId}`);

    // 使用信号量优雅控制并发：所有请求一起开始，但最多3个同时执行
    const promises = charactersToUpdate.map(async (character) => {
      let acquired = false;
      
      try {
        // 获取并发许可
        await concurrencyLimiter.acquire();
        acquired = true;
        
        // 确保API速率限制
        await apiLimiter.wait();
        
        console.log(`Fetching details for character ${character.id} (${character.name})...`);
        
        // 获取角色详细信息
        const characterDetail = await getCharacterDetail(character.id);
        
        // 存储角色信息
        await upsertCharacter(characterDetail);
        
        return { success: true, characterId: character.id };
      } catch (error) {
        console.error(`Failed to sync character ${character.id}:`, error);
        return { success: false, characterId: character.id, error };
      } finally {
        // 只有成功获取许可后才释放
        if (acquired) {
          concurrencyLimiter.release();
        }
      }
    });

    // 等待所有角色处理完成
    const results = await Promise.allSettled(promises);
    
    // 统计最终结果
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    console.log(`Successfully synced ${successful} characters, failed ${failed} for subject ${subjectId}`);
  } catch (error) {
    console.error(`Error syncing characters for subject ${subjectId}:`, error);
    throw error;
  }
}

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
      characters: [], // 初始化为空数组，后续会更新
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

    // 同步每个subject的角色信息
    for (const subject of subjects) {
      try {
        await syncSubjectCharacters(subject.id);
      } catch (error) {
        console.error(`Failed to sync characters for subject ${subject.id}:`, error);
        // 继续处理下一个subject，不中断整个流程
      }
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