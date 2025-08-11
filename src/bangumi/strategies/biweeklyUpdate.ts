/**
 * 双周更新策略
 * 更新前两年的所有条目
 */

import { BaseSyncStrategy } from './base';
import { SyncOptions, SubjectType } from '../types';
import { bangumiApiClient } from '../api/client';
import { bangumiConfig } from '../config';
import { subjectSyncService } from '../services/subjectSync';

export class BiweeklyUpdateStrategy extends BaseSyncStrategy {
  name = 'BiweeklyUpdate';
  description = '双周更新，更新前两年的所有条目';

  protected async doExecute(options?: Partial<SyncOptions>): Promise<void> {
    const config = bangumiConfig.get();
    const cooldownDays = options?.cooldownDays || config.cooldown.biweekly;

    const currentYear = new Date().getFullYear();
    const targetYears = [currentYear - 2, currentYear - 1];

    console.log(`Updating entries for years ${targetYears.join(', ')}...`);

    // 获取总数以显示进度
    const response = await bangumiApiClient.getSubjects({
      type: SubjectType.Anime,
      limit: 1
    });
    const total = response.total;
    this.updateProgress(0, total);

    let processed = 0;
    const batchGenerator = bangumiApiClient.getSubjectsBatch({
      type: SubjectType.Anime
    });

    for await (const batch of batchGenerator) {
      if (this.checkShouldStop()) break;

      for (const subject of batch) {
        if (this.checkShouldStop()) break;

        // 检查日期是否在目标年份范围内
        if (subject.date) {
          try {
            const entryYear = new Date(subject.date).getFullYear();
            if (targetYears.includes(entryYear)) {
              // 同步条目和角色
              const syncResult = await subjectSyncService.syncSubject(subject, {
                cooldownDays,
                skipCharacters: options?.skipCharacters
              });

              this.result.subjectsProcessed++;
              this.result.charactersProcessed += syncResult.charactersProcessed;

              if (syncResult.errors.length > 0) {
                syncResult.errors.forEach(error => {
                  this.recordError(subject.id, error);
                });
              }
            }
          } catch (error) {
            this.recordError(subject.id, error);
          }
        }

        processed++;
        this.updateProgress(processed, total);
      }
    }

    console.log(`Biweekly update completed: ${this.result.subjectsProcessed} subjects processed`);
  }
}