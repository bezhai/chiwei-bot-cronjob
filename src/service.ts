import send_msg from "./lark";
import { getFollowersByTag } from "./pixiv";

// 异步下载服务
export const startDownload = async (): Promise<void> => {
    console.log('Download service started...');
  
    try {
      // 获取 "已上传" 标签下的关注者
      const authorArr = await getFollowersByTag('已上传');
  
      // 如果成功获取关注者
      if (authorArr && authorArr.length > 0) {
        console.log('Fetched authors:', authorArr);
        // 这里放置你的下载逻辑
        // 假设你需要对每个作者执行下载操作
        for (const author of authorArr) {
          console.log(`Downloading images for author: ${author.userName}`);
          // 执行下载逻辑...
        }
      } else {
        // 如果没有关注者，发送消息
        await send_msg(process.env.SELF_CHAT_ID, '没有找到关注者');
      }
    } catch (err) {
      // 如果获取关注者出错，发送错误消息
      console.error('Error fetching followers:', err);
      await send_msg(process.env.SELF_CHAT_ID, '下载图片服务获取元信息失败');
    }
  };