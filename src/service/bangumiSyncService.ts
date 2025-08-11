import { bangumiRequest } from '../api/bangumi';
import { BangumiSubject, SubjectCharacter } from '../mongo/types';
import { getSubjectCharacters, getCharacterDetail, RelatedCharacter } from './bangumiService';
import {
  shouldUpdateCharacter,
  upsertCharacter,
  updateSubjectCharacters,
  updateSubjectMetadata,
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


