/**
 * 月度轮换更新策略
 * 按月份轮换更新条目
 */

import { BaseSyncStrategy } from './base';
import { SyncOptions, SubjectType } from '../types';
import { bangumiApiClient } from '../api/client';
import { bangumiDataService } from '../data/service';
import { bangumiConfig } from '../config';
import { subjectSyncService } from '../services/subjectSync';

export class MonthlyRotationStrategy extends BaseSyncStrategy {
  name = 'MonthlyRotation';
  description = '月度轮换更新，按月份轮换更新条目';

  protected async doExecute(options?: Partial<SyncOptions>): Promise<void> {
    const config = bangumiConfig.get();
    const cooldownDays = options?.cooldownDays || config.cooldown.monthly;

    // 获取当前轮询月份
    const currentMonth = await bangumiDataService.getCurrentRotationMonth();
    console.log(`Current rotation month: ${this.getMonthDisplayName(currentMonth)}`);

    if (currentMonth === 0) {
      // 处理无月份的条目
      await this.processSubjectsWithoutMonth(cooldownDays, options?.skipCharacters);
    } else {
      // 处理指定月份的条目
      await this.processSubjectsByMonth(currentMonth, cooldownDays, options?.skipCharacters);
    }

    // 更新到下一个月份
    await bangumiDataService.setNextRotationMonth(currentMonth);

    console.log(`Monthly rotation completed: ${this.result.subjectsProcessed} subjects processed`);
  }

  /**
   * 处理无月份的条目
   */
  private async processSubjectsWithoutMonth(
    cooldownDays: number,
    skipCharacters?: boolean
  ): Promise<void> {
    console.log('Processing subjects without month...');

    const subjectIds = await bangumiDataService.getSubjectsWithoutMonth(SubjectType.Anime);
    
    if (subjectIds.length === 0) {
      console.log('No subjects without month found');
      return;
    }

    console.log(`Found ${subjectIds.length} subjects without month`);
    this.updateProgress(0, subjectIds.length);

    let processed = 0;
    for (const subjectId of subjectIds) {
      if (this.checkShouldStop()) break;

      try {
        // 获取单个条目详情
        const subject = await bangumiApiClient.getSubject(subjectId);
        
        if (subject) {
          const syncResult = await subjectSyncService.syncSubject(subject, {
            cooldownDays,
            skipCharacters
          });

          this.result.subjectsProcessed++;
          this.result.charactersProcessed += syncResult.charactersProcessed;

          if (syncResult.errors.length > 0) {
            syncResult.errors.forEach(error => {
              this.recordError(subjectId, error);
            });
          }
        }
      } catch (error) {
        this.recordError(subjectId, error);
      }

      processed++;
      this.updateProgress(processed, subjectIds.length);
    }
  }

  /**
   * 处理指定月份的条目
   */
  private async processSubjectsByMonth(
    month: number,
    cooldownDays: number,
    skipCharacters?: boolean
  ): Promise<void> {
    console.log(`Processing subjects for month ${month}...`);

    // 获取该月份的条目总数
    const response = await bangumiApiClient.getSubjects({
      type: SubjectType.Anime,
      month,
      limit: 1
    });

    const total = response.total;
    if (total === 0) {
      console.log(`No subjects found for month ${month}`);
      return;
    }

    console.log(`Found ${total} subjects for month ${month}`);
    this.updateProgress(0, total);

    let processed = 0;
    const batchGenerator = bangumiApiClient.getSubjectsBatch({
      type: SubjectType.Anime,
      month
    });

    for await (const batch of batchGenerator) {
      if (this.checkShouldStop()) break;

      for (const subject of batch) {
        if (this.checkShouldStop()) break;

        try {
          const syncResult = await subjectSyncService.syncSubject(subject, {
            cooldownDays,
            skipCharacters
          });

          this.result.subjectsProcessed++;
          this.result.charactersProcessed += syncResult.charactersProcessed;

          if (syncResult.errors.length > 0) {
            syncResult.errors.forEach(error => {
              this.recordError(subject.id, error);
            });
          }
        } catch (error) {
          this.recordError(subject.id, error);
        }

        processed++;
        this.updateProgress(processed, total);
      }
    }
  }

  /**
   * 获取月份的显示名称
   */
  private getMonthDisplayName(month: number): string {
    if (month === 0) {
      return '无月份';
    }
    return `${month}月`;
  }
}

/**
 * 月度轮换管理函数
 */
export async function getRotationStatus(): Promise<{
  currentMonth: number;
  displayName: string;
  nextMonth: number;
  nextDisplayName: string;
}> {
  const currentMonth = await bangumiDataService.getCurrentRotationMonth();
  const nextMonth = (currentMonth + 1) % 13;

  return {
    currentMonth,
    displayName: currentMonth === 0 ? '无月份' : `${currentMonth}月`,
    nextMonth,
    nextDisplayName: nextMonth === 0 ? '无月份' : `${nextMonth}月`
  };
}

export async function resetRotationMonth(month: number): Promise<void> {
  await bangumiDataService.resetRotationMonth(month);
}