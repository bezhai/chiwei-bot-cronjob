import { bangumiRequest } from '../api/bangumi';
import { BangumiSubject } from '../mongo/types';
import { getSubjectCharacters } from './bangumiService';
import {
  shouldUpdateCharacterWithCooldown,
  upsertCharacter,
  updateSubjectCharacters,
  updateSubjectMetadata,
  getLocalBangumiSubjectCount,
} from '../mongo/service';

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


// 冷却周期配置（天数）
const COOLDOWN_DAILY = 3; // 每日更新角色冷却3天
const COOLDOWN_BIWEEKLY = 14; // 双周更新角色冷却14天
const COOLDOWN_MONTHLY_MIN = 30; // 月度更新最小30天
const COOLDOWN_MONTHLY_MAX = 90; // 月度更新最大90天

/**
 * 获取Bangumi线上type=2的总数量
 */
async function getOnlineTotalCount(): Promise<number> {
  try {
    const response = await bangumiRequest({
      path: '/v0/subjects',
      method: 'GET',
      params: { type: 2, limit: 1, offset: 0 }
    }) as BangumiApiResponse;
    return response.total;
  } catch (error) {
    console.error('Failed to get online total count:', error);
    throw error;
  }
}

/**
 * 获取数据库中type=2的条目数量
 */
async function getLocalTotalCount(): Promise<number> {
  try {
    return await getLocalBangumiSubjectCount();
  } catch (error) {
    console.error('Failed to get local total count:', error);
    return 0;
  }
}

/**
 * 计算冷却周期（月度更新使用）
 * @param dateStr - 条目日期字符串
 * @returns 冷却天数（30-90天）
 */
function calculateCooldownPeriod(dateStr?: string): number {
  if (!dateStr) {
    return COOLDOWN_MONTHLY_MAX;
  }

  try {
    const entryDate = new Date(dateStr);
    const now = new Date();
    const yearsDiff = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    if (yearsDiff > 10) {
      return COOLDOWN_MONTHLY_MAX;
    }

    // 线性计算：越新的条目冷却周期越短
    const ratio = Math.max(0, Math.min(1, (10 - yearsDiff) / 10));
    return Math.round(COOLDOWN_MONTHLY_MIN + (COOLDOWN_MONTHLY_MAX - COOLDOWN_MONTHLY_MIN) * ratio);
  } catch (error) {
    return COOLDOWN_MONTHLY_MAX;
  }
}


/**
 * 同步单个条目的角色信息（支持自定义冷却周期）
 */
async function syncSubjectCharactersWithCooldown(subjectId: number, cooldownDays: number): Promise<void> {
  try {
    console.log(`Syncing characters for subject ${subjectId} with cooldown ${cooldownDays} days...`);
    
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
        const needsUpdate = await shouldUpdateCharacterWithCooldown(character.id, cooldownDays);
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
        await rateLimiter.limit(); // 真正的1 QPS限速
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
 * 获取并存储指定范围的条目
 */
async function fetchAndStoreSubjectsInRange(
  type: 2,
  startOffset: number,
  endOffset: number,
  cooldownDays: number
): Promise<void> {
  const limit = 50;
  let currentOffset = startOffset;

  try {
    while (currentOffset < endOffset) {
      const response = await bangumiRequest({
        path: '/v0/subjects',
        method: 'GET',
        params: { type, limit, offset: currentOffset }
      }) as BangumiApiResponse;

      if (!response.data || response.data.length === 0) {
        break;
      }

      for (const item of response.data) {
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

        try {
          await updateSubjectMetadata(subject);
          await syncSubjectCharactersWithCooldown(subject.id, cooldownDays);
        } catch (error) {
          console.error(`Failed to process subject ${subject.id}:`, error);
        }
      }

      currentOffset += limit;
    }
  } catch (error) {
    console.error(`Error fetching subjects in range ${startOffset}-${endOffset}:`, error);
    throw error;
  }
}

/**
 * 每日增量更新（6:00执行）
 * 更新最新添加的条目
 */
export async function dailyIncrementalUpdate(): Promise<void> {
  try {
    console.log('Starting daily incremental update...');
    
    const onlineTotal = await getOnlineTotalCount();
    const localTotal = await getLocalTotalCount();
    
    // 计算起始偏移量（留50条buffer）
    const startOffset = Math.max(0, localTotal - 50);
    const endOffset = onlineTotal;
    
    if (startOffset >= endOffset) {
      console.log('No new entries to update');
      return;
    }

    console.log(`Updating from offset ${startOffset} to ${endOffset}`);
    await fetchAndStoreSubjectsInRange(2, startOffset, endOffset, COOLDOWN_DAILY);
    
    console.log('Daily incremental update completed');
  } catch (error) {
    console.error('Daily incremental update failed:', error);
    throw error;
  }
}

/**
 * 按年份更新（6:00执行）
 * 更新当前年份和下一年份的所有条目
 * 通过分页方式获取所有条目，然后按日期过滤
 */
export async function yearlyUpdate(): Promise<void> {
  try {
    console.log('Starting yearly update...');
    
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const targetYears = [currentYear, nextYear];
    
    console.log(`Updating entries for years ${targetYears.join(', ')}...`);
    
    const onlineTotal = await getOnlineTotalCount();
    await fetchAndStoreSubjectsByYear(2, 0, onlineTotal, targetYears, COOLDOWN_DAILY);
    
    console.log('Yearly update completed');
  } catch (error) {
    console.error('Yearly update failed:', error);
    throw error;
  }
}

/**
 * 按年份过滤更新条目
 */
async function fetchAndStoreSubjectsByYear(
  type: 2,
  startOffset: number,
  endOffset: number,
  targetYears: number[],
  cooldownDays: number
): Promise<void> {
  const limit = 50;
  let currentOffset = startOffset;

  try {
    while (currentOffset < endOffset) {
      const response = await bangumiRequest({
        path: '/v0/subjects',
        method: 'GET',
        params: { type, limit, offset: currentOffset }
      }) as BangumiApiResponse;

      if (!response.data || response.data.length === 0) {
        break;
      }

      for (const item of response.data) {
        // 检查日期是否在目标年份范围内
        if (item.date) {
          try {
            const entryYear = new Date(item.date).getFullYear();
            if (targetYears.includes(entryYear)) {
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

              try {
                await updateSubjectMetadata(subject);
                await syncSubjectCharactersWithCooldown(subject.id, cooldownDays);
              } catch (error) {
                console.error(`Failed to process subject ${subject.id}:`, error);
              }
            }
          } catch (dateError) {
            console.error(`Error processing date for subject ${item.id}:`, dateError);
          }
        }
      }

      currentOffset += limit;
    }
  } catch (error) {
    console.error(`Error fetching subjects by year ${targetYears.join(',')}:`, error);
    throw error;
  }
}

/**
 * 周更新（每7天执行）
 * 更新前两年的所有条目
 */
export async function biweeklyUpdate(): Promise<void> {
  try {
    console.log('Starting biweekly update...');
    
    const currentYear = new Date().getFullYear();
    const targetYears = [currentYear - 2, currentYear - 1];
    
    console.log(`Updating entries for years ${targetYears.join(', ')}...`);
    
    const onlineTotal = await getOnlineTotalCount();
    await fetchAndStoreSubjectsByYear(2, 0, onlineTotal, targetYears, COOLDOWN_BIWEEKLY);
    
    console.log('Biweekly update completed');
  } catch (error) {
    console.error('Biweekly update failed:', error);
    throw error;
  }
}

/**
 * 使用动态冷却周期获取并存储条目
 */
async function fetchAndStoreSubjectsWithDynamicCooldown(
  type: 2,
  startOffset: number,
  endOffset: number
): Promise<void> {
  const limit = 50;
  let currentOffset = startOffset;

  try {
    while (currentOffset < endOffset) {
      const response = await bangumiRequest({
        path: '/v0/subjects',
        method: 'GET',
        params: { type, limit, offset: currentOffset }
      }) as BangumiApiResponse;

      if (!response.data || response.data.length === 0) {
        break;
      }

      for (const item of response.data) {
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

        try {
          await updateSubjectMetadata(subject);
          
          // 计算动态冷却周期
          const cooldownDays = calculateCooldownPeriod(item.date);
          await syncSubjectCharactersWithCooldown(subject.id, cooldownDays);
        } catch (error) {
          console.error(`Failed to process subject ${subject.id}:`, error);
        }
      }

      currentOffset += limit;
    }
  } catch (error) {
    console.error('Error fetching subjects with dynamic cooldown:', error);
    throw error;
  }
}
