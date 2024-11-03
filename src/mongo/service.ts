import { Filter, SortDirection } from "mongodb";
import { MongoCollection } from "./collection";
import { DownloadTask, PixivImageInfo } from "./types";
import { DownloadTaskMap, ImgCollection } from "./client";

/**
 * 获取给定 illustIds 中最大值的 illust_id
 * @param collection - MongoDB 集合封装类
 * @param illustIds - 要查询的 illust_id 列表
 * @returns 最大的 illust_id 或 0（如果找不到）
 */
export async function getMaxIllustId(illustIds: number[]): Promise<number> {
  try {
    // 构建查询条件，查询 illust_id 在给定数组中的文档
    const filter = {
      illust_id: { $in: illustIds },
    };

    // 设置查询选项：排序 illust_id 倒序，限制结果数量为 1
    const options = {
      limit: 1,
      sort: { illust_id: -1 as SortDirection }, // 按照 illust_id 倒序排列
    };

    const result = await ImgCollection.find(filter, options);

    // 如果查询结果为空，返回 0
    if (result.length === 0) {
      return 0;
    }

    // 返回找到的最大 illust_id
    return result[0].illust_id || 0;
  } catch (error) {
    console.error("Error fetching max illust_id:", error);
    throw error;
  }
}

/**
 * 插入新的下载任务
 * @param illustId - 插画的 ID
 * @param r18Index - R18 索引
 * @returns 返回一个 Promise，表示是否成功插入新任务
 * @throws 如果在数据库操作中发生错误，将抛出错误
 */
export async function insertDownloadTask(
  illustId: string,
  r18Index: number
): Promise<boolean> {
  // 查询是否已经存在相同 illustId 的任务
  const filter: Filter<DownloadTask> = { illust_id: illustId };

  // 使用封装的 find 方法查找是否已经存在此任务
  const existingTasks = await DownloadTaskMap.find(filter);

  // 如果找到了现有任务，返回 false 表示未插入
  if (existingTasks.length > 0) {
    return false;
  }

  // 创建新的下载任务
  const newTask = new DownloadTask(illustId, r18Index);

  // 插入新任务
  await DownloadTaskMap.insertOne(newTask);

  // 返回 true 表示成功插入
  return true;
}
