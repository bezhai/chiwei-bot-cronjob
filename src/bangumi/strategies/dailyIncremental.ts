/**
 * 每日增量更新策略
 * 更新最新添加的条目
 */

import { BaseSyncStrategy } from './base';
import { SyncOptions, SubjectType } from '../types';
import { bangumiApiClient } from '../api/client';
import { bangumiDataService } from '../data/service';
import { bangumiConfig } from '../config';
import { subjectSyncService } from '../services/subjectSync';

export class DailyIncrementalStrategy extends BaseSyncStrategy {
  name = 'DailyIncremental';
  description = '每日增量更新，同步最新添加的条目';

  protected async doExecute(options?: Partial<SyncOptions>): Promise<void> {
    const config = bangumiConfig.get();
    const cooldownDays = options?.cooldownDays || config.cooldown.daily;

    // 获取线上和本地的条目总数
    const onlineTotal = await this.getOnlineTotal();
    const localTotal = await bangumiDataService.getSubjectCount(SubjectType.Anime);

    // 计算更新范围（留50条buffer）
    const startOffset = Math.max(0, localTotal - 50);
    const endOffset = onlineTotal;

    if (startOffset >= endOffset) {
      console.log('No new entries to update');
      return;
    }

    console.log(`Updating from offset ${startOffset} to ${endOffset}`);
    this.updateProgress(0, endOffset - startOffset);

    // 批量获取并处理条目
    let processed = 0;
    const batchGenerator = bangumiApiClient.getSubjectsBatch({
      type: SubjectType.Anime,
      offset: startOffset
    });

    for await (const batch of batchGenerator) {
      if (this.checkShouldStop()) break;

      for (const subject of batch) {
        if (this.checkShouldStop()) break;

        try {
          // 同步条目和角色
          const syncResult = await subjectSyncService.syncSubject(subject, {
            cooldownDays,
            skipCharacters: options?.skipCharacters
          });

          this.result.subjectsProcessed++;
          this.result.charactersProcessed += syncResult.charactersProcessed;
        } catch (error) {
          this.recordError(subject.id, error);
        }

        processed++;
        this.updateProgress(processed, endOffset - startOffset);
      }

      // 检查是否已经超过结束位置
      if (startOffset + processed >= endOffset) {
        break;
      }
    }
  }

  private async getOnlineTotal(): Promise<number> {
    try {
      const response = await bangumiApiClient.getSubjects({
        type: SubjectType.Anime,
        limit: 1,
        offset: 0
      });
      return response.total;
    } catch (error) {
      console.error('Failed to get online total count:', error);
      throw error;
    }
  }
}