import { bangumiRequest } from '../api/bangumi';
import { BangumiSubject } from '../mongo/types';
import { getSubjectCharacters } from './bangumiService';
import {
  shouldUpdateCharacterWithCooldown,
  upsertCharacter,
  updateSubjectCharacters,
  updateSubjectMetadata,
} from '../mongo/service';
import { BangumiSubjectCollection } from '../mongo/client';
import redisClient from '../redis/redisClient';

/**
 * QPS限速器
 */
class RateLimiter {
  private lastRequestTime = 0;
  private interval: number;

  constructor(qps: number) {
    this.interval = 1000 / qps; // QPS转换为毫秒间隔
  }

  async limit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.interval) {
      const waitTime = this.interval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

// 创建1 QPS限速器实例
const rateLimiter = new RateLimiter(1);

interface BangumiApiResponse {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

// 月份轮询更新的冷却周期（天数）
const COOLDOWN_MONTHLY_ROTATION = 60; // 月份轮询更新角色冷却60天

// Redis键名
const REDIS_KEY_CURRENT_MONTH = 'bangumi:monthly_rotation:current_month';

/**
 * 获取当前轮询的月份
 * @returns 当前月份 (0-12, 0表示无月份)
 */
async function getCurrentRotationMonth(): Promise<number> {
  try {
    const monthStr = await redisClient.get(REDIS_KEY_CURRENT_MONTH);
    return monthStr ? parseInt(monthStr, 10) : 0;
  } catch (error) {
    console.error('Error getting current rotation month from Redis:', error);
    return 0; // 默认从0开始
  }
}

/**
 * 设置下一个轮询月份
 * @param currentMonth 当前月份
 */
async function setNextRotationMonth(currentMonth: number): Promise<void> {
  try {
    const nextMonth = (currentMonth + 1) % 13; // 0-12循环
    await redisClient.set(REDIS_KEY_CURRENT_MONTH, nextMonth.toString());
    console.log(`Updated rotation month from ${currentMonth} to ${nextMonth}`);
  } catch (error) {
    console.error('Error setting next rotation month in Redis:', error);
  }
}

/**
 * 获取月份的显示名称
 * @param month 月份 (0-12)
 * @returns 月份显示名称
 */
function getMonthDisplayName(month: number): string {
  if (month === 0) {
    return '无月份';
  }
  return `${month}月`;
}

/**
 * 从日期字符串中提取月份
 * @param dateStr 日期字符串 (如 "2024-01-15")
 * @returns 月份 (1-12) 或 null
 */
function extractMonthFromDate(dateStr?: string): number | null {
  if (!dateStr) {
    return null;
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.getMonth() + 1; // getMonth() 返回 0-11，需要 +1
  } catch (error) {
    return null;
  }
}

/**
 * 同步单个条目的角色信息（月份轮询专用）
 */
async function syncSubjectCharactersForMonthlyRotation(subjectId: number): Promise<void> {
  try {
    console.log(`Syncing characters for subject ${subjectId} (monthly rotation)...`);
    
    const relatedCharacters = await getSubjectCharacters(subjectId);
    if (!relatedCharacters || relatedCharacters.length === 0) {
      console.log(`No characters found for subject ${subjectId}`);
      return;
    }

    const subjectCharacters = relatedCharacters.map(char => ({
      id: char.id,
      name: char.name,
      relation: char.relation
    }));

    await updateSubjectCharacters(subjectId, subjectCharacters);

    const charactersToUpdate: any[] = [];
    for (const character of relatedCharacters) {
      try {
        const needsUpdate = await shouldUpdateCharacterWithCooldown(character.id, COOLDOWN_MONTHLY_ROTATION);
        if (needsUpdate) {
          charactersToUpdate.push(character);
        } else {
          console.log(`Character ${character.id} (${character.name}) is within cooldown period, skipping...`);
        }
      } catch (error) {
        console.error(`Failed to check character ${character.id}:`, error);
      }
    }

    if (charactersToUpdate.length === 0) {
      console.log(`All characters for subject ${subjectId} are within cooldown period`);
      return;
    }

    console.log(`Need to update ${charactersToUpdate.length} characters for subject ${subjectId}`);

    let successful = 0;
    let failed = 0;
    for (const character of charactersToUpdate) {
      try {
        await rateLimiter.limit(); // 1 QPS限速
        await upsertCharacter(character);
        successful++;
      } catch (error) {
        console.error(`Failed to sync character ${character.id}:`, error);
        failed++;
      }
    }

    console.log(`Successfully synced ${successful} characters, failed ${failed} for subject ${subjectId}`);
  } catch (error) {
    console.error(`Error syncing characters for subject ${subjectId}:`, error);
    throw error;
  }
}

/**
 * 获取单个条目详情并更新
 * @param subjectId 条目ID
 */
async function fetchAndUpdateSingleSubject(subjectId: number): Promise<void> {
  try {
    await rateLimiter.limit(); // 1 QPS限速
    
    console.log(`Fetching subject details for ${subjectId}...`);
    
    const subjectData = await bangumiRequest({
      path: `/v0/subjects/${subjectId}`,
      method: 'GET'
    });

    const subject: Omit<BangumiSubject, 'characters'> = {
      id: subjectData.id,
      type: subjectData.type,
      name: subjectData.name,
      name_cn: subjectData.name_cn,
      summary: subjectData.summary,
      date: subjectData.date,
      platform: subjectData.platform,
      images: subjectData.images,
      rating: subjectData.rating,
      collection: subjectData.collection,
      tags: subjectData.tags,
      eps: subjectData.eps,
      total_episodes: subjectData.total_episodes,
      volumes: subjectData.volumes,
      locked: subjectData.locked,
      nsfw: subjectData.nsfw,
      series: subjectData.series,
      meta_tags: subjectData.meta_tags,
      infobox: subjectData.infobox,
      created_at: new Date(),
      updated_at: new Date()
    };

    await updateSubjectMetadata(subject);
    await syncSubjectCharactersForMonthlyRotation(subject.id);
    
    console.log(`Successfully updated subject ${subjectId} (${subject.name})`);
  } catch (error) {
    console.error(`Failed to update subject ${subjectId}:`, error);
    throw error;
  }
}

/**
 * 获取并更新指定月份的条目
 * @param month 月份 (0表示无月份, 1-12表示对应月份)
 */
async function fetchAndUpdateSubjectsByMonth(month: number): Promise<void> {
  try {
    console.log(`Starting to update subjects for ${getMonthDisplayName(month)}...`);

    let subjectIds: number[] = [];

    if (month === 0) {
      // 无月份：从本地数据库筛选出date为空或无效的条目
      console.log('Fetching subjects with no month from local database...');
      
      const subjects = await BangumiSubjectCollection.find(
        {
          type: 2,
          date: null,
        } as any,
        { projection: { id: 1 } }
      );
      
      subjectIds = subjects.map(subject => subject.id);
      console.log(`Found ${subjectIds.length} subjects with no valid date`);
    } else {
      // 有月份：使用API筛选
      console.log(`Fetching subjects for month ${month} from API...`);
      
      const limit = 50;
      let currentOffset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await bangumiRequest({
          path: '/v0/subjects',
          method: 'GET',
          params: { 
            type: 2, 
            limit, 
            offset: currentOffset,
            month: month // 使用month参数筛选
          }
        }) as BangumiApiResponse;

        if (!response.data || response.data.length === 0) {
          hasMore = false;
          break;
        }

        // 直接处理这批数据，不需要收集所有ID
        for (const item of response.data) {
          try {
            const subject: Omit<BangumiSubject, 'characters'> = {
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
            };

            await updateSubjectMetadata(subject);
            await syncSubjectCharactersForMonthlyRotation(subject.id);
          } catch (error) {
            console.error(`Failed to process subject ${item.id}:`, error);
          }
        }

        currentOffset += limit;
        
        // 检查是否还有更多数据
        if (currentOffset >= response.total) {
          hasMore = false;
        }
      }
      
      console.log(`Completed processing subjects for month ${month}`);
      return;
    }

    // 处理无月份的条目（需要逐个调用单条目API）
    if (subjectIds.length === 0) {
      console.log(`No subjects found for ${getMonthDisplayName(month)}`);
      return;
    }

    console.log(`Processing ${subjectIds.length} subjects with no month...`);
    
    let successful = 0;
    let failed = 0;
    
    for (const subjectId of subjectIds) {
      try {
        await fetchAndUpdateSingleSubject(subjectId);
        successful++;
      } catch (error) {
        console.error(`Failed to update subject ${subjectId}:`, error);
        failed++;
      }
    }

    console.log(`Completed processing subjects for ${getMonthDisplayName(month)}: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error(`Error processing subjects for month ${month}:`, error);
    throw error;
  }
}

/**
 * 月份轮询更新主函数
 * 每周一下午2点执行，轮询更新不同月份的条目
 */
export async function monthlyRotationUpdate(): Promise<void> {
  try {
    console.log('Starting monthly rotation update...');
    
    const currentMonth = await getCurrentRotationMonth();
    console.log(`Current rotation month: ${getMonthDisplayName(currentMonth)}`);
    
    await fetchAndUpdateSubjectsByMonth(currentMonth);
    
    // 更新到下一个月份
    await setNextRotationMonth(currentMonth);
    
    console.log('Monthly rotation update completed');
  } catch (error) {
    console.error('Monthly rotation update failed:', error);
    throw error;
  }
}

/**
 * 重置月份轮询到指定月份（用于手动调试）
 * @param month 要设置的月份 (0-12)
 */
export async function resetRotationMonth(month: number): Promise<void> {
  if (month < 0 || month > 12) {
    throw new Error('Month must be between 0 and 12');
  }
  
  try {
    await redisClient.set(REDIS_KEY_CURRENT_MONTH, month.toString());
    console.log(`Reset rotation month to ${getMonthDisplayName(month)}`);
  } catch (error) {
    console.error('Error resetting rotation month:', error);
    throw error;
  }
}

/**
 * 获取当前轮询状态
 */
export async function getRotationStatus(): Promise<{ currentMonth: number; displayName: string }> {
  const currentMonth = await getCurrentRotationMonth();
  return {
    currentMonth,
    displayName: getMonthDisplayName(currentMonth)
  };
}