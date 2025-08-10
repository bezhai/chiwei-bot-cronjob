import { bangumiRequest } from '../api/bangumi';
import { BangumiSubject, SubjectCharacter } from '../mongo/types';
import { send_msg } from '../lark';
import { getSubjectCharacters, getCharacterDetail, RelatedCharacter } from './bangumiService';
import {
  shouldUpdateCharacter,
  upsertCharacter,
  updateSubjectCharacters,
  updateSubjectMetadata,
} from '../mongo/service';
import redisClient from '../redis/redisClient';

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

// 仅针对 getCharacterDetail 的 1 QPS 限速
let lastCharacterDetailAt: number | null = null;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function throttleCharacterDetail(): Promise<void> {
  const now = Date.now();
  if (lastCharacterDetailAt === null) {
    lastCharacterDetailAt = now;
    return;
  }
  const elapsed = now - lastCharacterDetailAt;
  if (elapsed < 1000) {
    await sleep(1000 - elapsed);
  }
  lastCharacterDetailAt = Date.now();
}

// Redis 进度键与 TTL（14 天）
const REDIS_OFFSET_KEY = 'bangumi:sync:anime:offset';
const REDIS_OFFSET_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 天

export async function getSavedOffset(): Promise<number> {
  try {
    const v = await redisClient.get(REDIS_OFFSET_KEY);
    const parsed = v ? parseInt(v, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (e) {
    console.error('Failed to read offset from Redis, fallback to 0:', e);
    return 0;
  }
}

async function saveOffset(nextOffset: number): Promise<void> {
  try {
    await redisClient.set(REDIS_OFFSET_KEY, String(nextOffset), 'EX', REDIS_OFFSET_TTL_SECONDS);
    // 可选：记录日志
    console.log(`Saved offset to Redis: ${nextOffset}`);
  } catch (e) {
    console.error('Failed to save offset to Redis:', e);
  }
}

/**
 * 清理Redis中的同步进度（同步完成后调用）
 */
async function clearSavedOffset(): Promise<void> {
  try {
    await redisClient.del(REDIS_OFFSET_KEY);
    console.log('Cleared bangumi sync offset from Redis');
  } catch (e) {
    console.error('Failed to clear offset from Redis:', e);
  }
}

/**
 * 检查并恢复未完成的Bangumi同步任务
 * 如果Redis中存在未完成的同步进度，则立即开始同步
 */
export async function checkAndResumeUnfinishedSync(): Promise<void> {
  try {
    const savedOffset = await getSavedOffset();
    if (savedOffset > 0) {
      console.log(`Found unfinished bangumi sync at offset ${savedOffset}, resuming...`);
      await syncAllAnimeSubjects();
      console.log('Successfully resumed and completed bangumi sync');
    } else {
      console.log('No unfinished bangumi sync found');
    }
  } catch (error) {
    console.error('Error in resume bangumi sync:', error);
    throw error;
  }
}

/**
 * 同步单个条目的角色信息
 * @param subjectId - 条目ID
 */
async function syncSubjectCharacters(subjectId: number): Promise<void> {
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

    // 角色详情顺序处理 + 1 QPS 限速
    let successful = 0;
    let failed = 0;
    for (const character of charactersToUpdate) {
      try {
        await throttleCharacterDetail();
        console.log(`Fetching details for character ${character.id} (${character.name})...`);
        const characterDetail = await getCharacterDetail(character.id);
        await upsertCharacter(characterDetail);
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
  try {
    const response = await bangumiRequest({
      path: '/v0/subjects',
      method: 'GET',
      params: { type, limit, offset }
    }) as BangumiApiResponse;

    if (!response.data || response.data.length === 0) {
      return 0;
    }

    // 转换数据格式并写入元数据（不覆盖 characters）
    const subjectsMeta: Omit<BangumiSubject, 'characters'>[] = response.data.map(item => ({
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

    for (const subject of subjectsMeta) {
      try {
        await updateSubjectMetadata(subject);
      } catch (e) {
        console.error(`Failed to update subject metadata for ${subject.id}:`, e);
      }
    }

    // 同步每个subject的角色信息（获取列表成功才写入，不覆盖失败）
    for (const subject of subjectsMeta) {
      try {
        await syncSubjectCharacters(subject.id);
      } catch (error) {
        console.error(`Failed to sync characters for subject ${subject.id}:`, error);
        // 继续处理下一个subject，不中断整个流程
      }
    }

    return subjectsMeta.length;
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
    // 从 Redis 读取进度（断点续传）
    offset = await getSavedOffset();

    // 第一次请求获取 total 值及当页数据
    const firstResponse = await bangumiRequest({
      path: '/v0/subjects',
      method: 'GET',
      params: { type, limit, offset }
    }) as BangumiApiResponse;

    total = firstResponse.total;
    console.log(`Total anime subjects to sync: ${total}`);

    // 处理第一页数据（避免重复抓取首页）
    if (firstResponse.data && firstResponse.data.length > 0) {
      // 复用现有逻辑：构造临时响应对象交给处理函数
      const temp: BangumiApiResponse = firstResponse;
      // 人为构造：通过本地处理流程（不再次请求）
      const subjectsMeta: Omit<BangumiSubject, 'characters'>[] = temp.data.map((item: any) => ({
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

      for (const subject of subjectsMeta) {
        try {
          await updateSubjectMetadata(subject);
        } catch (e) {
          console.error(`Failed to update subject metadata for ${subject.id}:`, e);
        }
      }

      for (const subject of subjectsMeta) {
        try {
          await syncSubjectCharacters(subject.id);
        } catch (error) {
          console.error(`Failed to sync characters for subject ${subject.id}:`, error);
        }
      }

      offset += limit;
      await saveOffset(offset);
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
        await saveOffset(offset);
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
      // 同步完成后清理Redis中的进度记录
      await clearSavedOffset();
    }
  } catch (error) {
    console.error('Error syncing anime subjects:', error);
    throw error;
  }
}