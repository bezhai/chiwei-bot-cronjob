/**
 * 条目同步服务
 * 提供统一的条目和角色同步功能
 */

import { Subject, SubjectCharacter, Character, SyncOptions } from '../types';
import { bangumiApiClient } from '../api/client';
import { bangumiDataService } from '../data/service';
import { bangumiConfig } from '../config';

export interface SubjectSyncResult {
  charactersProcessed: number;
  errors: string[];
}

export class SubjectSyncService {
  /**
   * 同步单个条目（包括元数据和角色）
   */
  async syncSubject(
    subject: Subject,
    options: Partial<SyncOptions> = {}
  ): Promise<SubjectSyncResult> {
    const result: SubjectSyncResult = {
      charactersProcessed: 0,
      errors: []
    };

    try {
      // 更新条目元数据
      await bangumiDataService.upsertSubject(subject);

      // 如果不跳过角色同步
      if (!options.skipCharacters) {
        const charactersResult = await this.syncSubjectCharacters(
          subject.id,
          options.cooldownDays || bangumiConfig.get().cooldown.daily
        );
        result.charactersProcessed = charactersResult.charactersProcessed;
        result.errors.push(...charactersResult.errors);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to sync subject ${subject.id}: ${errorMsg}`);
    }

    return result;
  }

  /**
   * 同步条目的角色信息
   */
  async syncSubjectCharacters(
    subjectId: number,
    cooldownDays: number
  ): Promise<SubjectSyncResult> {
    const result: SubjectSyncResult = {
      charactersProcessed: 0,
      errors: []
    };

    try {
      console.log(`Syncing characters for subject ${subjectId} with cooldown ${cooldownDays} days...`);

      // 获取条目关联的角色列表
      const relatedCharacters = await bangumiApiClient.getSubjectCharacters(subjectId);

      if (!relatedCharacters || relatedCharacters.length === 0) {
        console.log(`No characters found for subject ${subjectId}`);
        return result;
      }

      // 转换为SubjectCharacter格式并更新
      const subjectCharacters: SubjectCharacter[] = relatedCharacters.map(char => ({
        id: char.id,
        name: char.name,
        relation: char.relation
      }));

      await bangumiDataService.updateSubjectCharacters(subjectId, subjectCharacters);

      // 检查并更新需要更新的角色
      const charactersToUpdate = [];
      for (const character of relatedCharacters) {
        try {
          const needsUpdate = await bangumiDataService.shouldUpdateCharacter(
            character.id,
            cooldownDays
          );
          if (needsUpdate) {
            charactersToUpdate.push(character);
          } else {
            console.log(`Character ${character.id} (${character.name}) is within cooldown period`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to check character ${character.id}: ${errorMsg}`);
        }
      }

      if (charactersToUpdate.length === 0) {
        console.log(`All characters for subject ${subjectId} are within cooldown period`);
        return result;
      }

      console.log(`Need to update ${charactersToUpdate.length} characters for subject ${subjectId}`);

      // 更新角色详情
      for (const character of charactersToUpdate) {
        try {
          const characterDetail = await bangumiApiClient.getCharacter(character.id);
          await bangumiDataService.upsertCharacter(characterDetail);
          result.charactersProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to sync character ${character.id}: ${errorMsg}`);
        }
      }

      console.log(
        `Synced ${result.charactersProcessed}/${charactersToUpdate.length} characters for subject ${subjectId}`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error syncing characters for subject ${subjectId}: ${errorMsg}`);
    }

    return result;
  }

  /**
   * 批量同步条目
   */
  async syncSubjects(
    subjects: Subject[],
    options: Partial<SyncOptions> = {}
  ): Promise<{
    totalSubjects: number;
    totalCharacters: number;
    errors: string[];
  }> {
    let totalCharacters = 0;
    const errors: string[] = [];

    for (const subject of subjects) {
      const result = await this.syncSubject(subject, options);
      totalCharacters += result.charactersProcessed;
      errors.push(...result.errors);
    }

    return {
      totalSubjects: subjects.length,
      totalCharacters,
      errors
    };
  }

  /**
   * 计算动态冷却周期（基于条目日期）
   */
  calculateDynamicCooldown(dateStr?: string): number {
    const config = bangumiConfig.get();

    if (!dateStr) {
      return config.cooldown.monthlyMax;
    }

    try {
      const entryDate = new Date(dateStr);
      const now = new Date();
      const yearsDiff = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

      if (yearsDiff > 10) {
        return config.cooldown.monthlyMax;
      }

      // 线性计算：越新的条目冷却周期越短
      const ratio = Math.max(0, Math.min(1, (10 - yearsDiff) / 10));
      return Math.round(
        config.cooldown.monthlyMin + 
        (config.cooldown.monthlyMax - config.cooldown.monthlyMin) * ratio
      );
    } catch (error) {
      return config.cooldown.monthlyMax;
    }
  }
}

// 导出单例
export const subjectSyncService = new SubjectSyncService();