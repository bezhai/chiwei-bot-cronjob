import axios from "axios";
import pixivProxy from "./pixivProxy";

/**
 * 获取用户指定标签下的关注列表
 * @param tag 标签名称
 * @returns 关注者信息数组
 */
async function getFollowersByTag(tag: string): Promise<FollowerInfo[]> {
  const userId = "35384654"; // 固定的用户 ID
  const pageSize = 24; // 每页获取的关注者数量
  const followers: FollowerInfo[] = []; // 存储所有关注者

  let page = 1;
  let total = 0;

  do {
    // 构造API请求的URL和Referer
    const pixivUrl = `https://www.pixiv.net/ajax/user/${userId}/following`;
    const referer = `https://www.pixiv.net/users/${userId}/following/${encodeURIComponent(
      tag
    )}?p=${page}`;

    try {
      // 调用 pixivProxy 以发送带有查询参数的 POST 请求
      const response = await pixivProxy<PixivGenericResponse<FollowerBody>>(
        pixivUrl,
        referer,
        {
          offset: (page - 1) * pageSize,
          limit: pageSize,
          rest: "show",
          tag: tag,
          lang: "zh",
        }
      );

      // 确保API请求成功并且返回了有效的body数据
      const { error, body } = response;
      if (error || !body) {
        throw new Error(response.message || "Failed to fetch followers");
      }

      // 这里debug
      console.log("body", body);
      return [];

      // 添加当前页的用户到总的关注者列表中
      // followers.push(...body.users);
      // total = body.total;

      // 增加页数，准备下一次请求
      page++;
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      throw error;
    }

    // 等待2秒以避免频繁请求
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (followers.length < total);

  return followers;
}

export { getFollowersByTag };