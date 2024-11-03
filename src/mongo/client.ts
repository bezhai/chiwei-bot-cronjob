import { MongoClient } from "mongodb";
import { MongoCollection } from "./collection";
import { DownloadTask, PixivImageInfo, TranslateWord } from "./types";

// MongoDB 客户端实例
let db: MongoClient;

// 定义 MongoDB 集合实例
export let ImgCollection: MongoCollection<PixivImageInfo>;
export let DownloadTaskMap: MongoCollection<DownloadTask>;
export let TranslateWordMap: MongoCollection<TranslateWord>;

export const mongoInitPromise = (async () => {
  try {
    const url = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@mongo/chiwei?connectTimeoutMS=2000&authSource=admin`;

    db = new MongoClient(url);
    await db.connect(); // 连接到 MongoDB

    const database = db.db("chiwei"); // 选择数据库

    // 初始化各个集合
    ImgCollection = new MongoCollection<PixivImageInfo>(
      database.collection("img_map")
    );
    DownloadTaskMap = new MongoCollection<DownloadTask>(
      database.collection("download_task")
    );
    TranslateWordMap = new MongoCollection<TranslateWord>(
      database.collection("trans_map")
    );

    console.log("MongoDB initialization completed.");
  } catch (err) {
    console.error("MongoDB initialization failed:", err);
    throw err;
  }
})();
