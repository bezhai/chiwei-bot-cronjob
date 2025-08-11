/**
 * Bangumi 数据访问服务
 * 提供统一的数据库操作接口
 */

import { 
  BangumiSubjectDocument, 
  BangumiCharacterDocument,
  Subject,
  Character,
  SubjectCharacter,
  SubjectType
} from '../types';
import { BangumiSubjectCollection, BangumiCharacterCollection } from '../../mongo/client';
import redisClient from '../../redis/redisClient';
import { bangumiConfig } from '../config';

export class BangumiDataService {
  /**
   * 获取条目数量
   */
  async getSubjectCount(type?: SubjectType): Promise<number> {
    try {
      const filter = type ? { type } : {};
      return await BangumiSubjectCollection.countDocuments(filter);
    } catch (error) {
      console.error('Error getting subject count:', error);
      return 0;
    }
  }

  /**
   * 获取角色数量
   */
  async getCharacterCount(): Promise<number> {
    try {
      return await BangumiCharacterCollection.countDocuments({});
    } catch (error) {
      console.error('Error getting character count:', error);
      return 0;
    }
  }

  /**
   * 插入或更新条目
   */
  async upsertSubject(subject: Subject): Promise<void> {
    try {
      const document: Omit<BangumiSubjectDocument, '_id' | 'characters'> = {
        ...subject,
        created_at: new Date(),
        updated_at: new Date()
      };

      await BangumiSubjectCollection.updateOneOrigin(
        { id: subject.id },
        {
          $set: document,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );

      console.log(`Updated subject ${subject.id} (${subject.name})`);
    } catch (error) {
      console.error(`Error upserting subject ${subject.id}:`, error);
      throw error;
    }
  }

  /**
   * 插入或更新角色
   */
  async upsertCharacter(character: Character): Promise<void> {
    try {
      const document: Omit<BangumiCharacterDocument, '_id'> = {
        ...character,
        created_at: new Date(),
        updated_at: new Date()
      };

      await BangumiCharacterCollection.updateOneOrigin(
        { id: character.id },
        {
          $set: document,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );

      console.log(`Updated character ${character.id} (${character.name})`);
    } catch (error) {
      console.error(`Error upserting character ${character.id}:`, error);
      throw error;
    }
  }

  /**
   * 更新条目的角色列表
   */
  async updateSubjectCharacters(
    subjectId: number,
    characters: SubjectCharacter[]
  ): Promise<void> {
    try {
      await BangumiSubjectCollection.updateOne(
        { id: subjectId },
        {
            characters: characters,
            updated_at: new Date()
          }
      );

      console.log(`Updated ${characters.length} characters for subject ${subjectId}`);
    } catch (error) {
      console.error(`Error updating characters for subject ${subjectId}:`, error);
      throw error;
    }
  }

  /**
   * 检查角色是否需要更新
   */
  async shouldUpdateCharacter(
    characterId: number,
    cooldownDays: number
  ): Promise<boolean> {
    try {
      const character = await BangumiCharacterCollection.findOne({ id: characterId });

      if (!character) {
        return true; // 角色不存在，需要获取
      }

      // 检查是否超过冷却周期
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);

      return character.updated_at < cooldownDate;
    } catch (error) {
      console.error(`Error checking character update status for ${characterId}:`, error);
      return true; // 出错时默认需要更新
    }
  }

  /**
   * 获取条目
   */
  async getSubject(id: number): Promise<BangumiSubjectDocument | null> {
    try {
      return await BangumiSubjectCollection.findOne({ id });
    } catch (error) {
      console.error(`Error getting subject ${id}:`, error);
      return null;
    }
  }

  /**
   * 获取角色
   */
  async getCharacter(id: number): Promise<BangumiCharacterDocument | null> {
    try {
      return await BangumiCharacterCollection.findOne({ id });
    } catch (error) {
      console.error(`Error getting character ${id}:`, error);
      return null;
    }
  }

  /**
   * 查找条目
   */
  async findSubjects(
    filter: any,
    options?: {
      limit?: number;
      skip?: number;
      sort?: any;
      projection?: any;
    }
  ): Promise<BangumiSubjectDocument[]> {
    try {
      return await BangumiSubjectCollection.find(filter, options);
    } catch (error) {
      console.error('Error finding subjects:', error);
      return [];
    }
  }

  /**
   * 获取没有月份的条目ID列表
   */
  async getSubjectsWithoutMonth(type: SubjectType): Promise<number[]> {
    try {
      const subjects = await this.findSubjects(
        {
          type,
          $or: [
            { date: null },
            { date: '' },
            { date: { $exists: false } }
          ]
        },
        { projection: { id: 1 } }
      );

      return subjects.map(s => s.id);
    } catch (error) {
      console.error('Error getting subjects without month:', error);
      return [];
    }
  }

  /**
   * Redis 操作：获取当前轮询月份
   */
  async getCurrentRotationMonth(): Promise<number> {
    try {
      const config = bangumiConfig.get();
      const monthStr = await redisClient.get(config.redis.monthlyRotationKey);
      return monthStr ? parseInt(monthStr, 10) : 0;
    } catch (error) {
      console.error('Error getting current rotation month:', error);
      return 0;
    }
  }

  /**
   * Redis 操作：设置下一个轮询月份
   */
  async setNextRotationMonth(currentMonth: number): Promise<void> {
    try {
      const config = bangumiConfig.get();
      const nextMonth = (currentMonth + 1) % 13; // 0-12循环
      await redisClient.set(config.redis.monthlyRotationKey, nextMonth.toString());
      console.log(`Updated rotation month from ${currentMonth} to ${nextMonth}`);
    } catch (error) {
      console.error('Error setting next rotation month:', error);
    }
  }

  /**
   * Redis 操作：重置轮询月份
   */
  async resetRotationMonth(month: number): Promise<void> {
    if (month < 0 || month > 12) {
      throw new Error('Month must be between 0 and 12');
    }

    try {
      const config = bangumiConfig.get();
      await redisClient.set(config.redis.monthlyRotationKey, month.toString());
      console.log(`Reset rotation month to ${month}`);
    } catch (error) {
      console.error('Error resetting rotation month:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<{
    totalSubjects: number;
    totalCharacters: number;
    subjectsByType: Record<number, number>;
    lastUpdate?: Date;
  }> {
    try {
      const totalSubjects = await this.getSubjectCount();
      const totalCharacters = await this.getCharacterCount();

      // 按类型统计条目数量
      const subjectsByType: Record<number, number> = {};
      for (const type of [1, 2, 3, 4, 6]) {
        subjectsByType[type] = await this.getSubjectCount(type as SubjectType);
      }

      // 获取最后更新时间
      const lastSubject = await this.findSubjects(
        {},
        { 
          sort: { updated_at: -1 }, 
          limit: 1,
          projection: { updated_at: 1 }
        }
      );

      return {
        totalSubjects,
        totalCharacters,
        subjectsByType,
        lastUpdate: lastSubject[0]?.updated_at
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        totalSubjects: 0,
        totalCharacters: 0,
        subjectsByType: {}
      };
    }
  }
}

// 导出单例
export const bangumiDataService = new BangumiDataService();