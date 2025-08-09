// types.ts
export interface MultiTag {
  name: string;
  translation: string;
  visible: boolean;
}

export interface PixivImageInfo {
  image_key?: string;
  pixiv_addr?: string;
  visible: boolean;
  author?: string;
  multi_tags?: MultiTag[];
  create_time?: Date;
  update_time?: Date;
  height?: number;
  width?: number;
  size?: number;
  need_download?: boolean;
  tos_file_name?: string;
  author_id?: string;
  del_flag?: boolean;
  illust_id?: number;
  title?: string;
}

export enum DownloadTaskStatus {
  Pending = 1, // 待执行
  Running = 2, // 执行中
  Fail = 3, // 失败
  Dead = 4, // 死信
  Success = 5, // 成功
}

export interface DownloadTaskParams {
  illust_id: string;
  status: DownloadTaskStatus;
  create_time: Date;
  update_time: Date;
  retry_time: number;
  last_run_time?: Date;
  last_run_error?: string;
}

export class DownloadTask {
  illust_id: string;
  status: DownloadTaskStatus;
  create_time: Date;
  update_time: Date;
  retry_time: number;
  last_run_time?: Date;
  last_run_error?: string;

  static MaxRetryTime = 3;

  constructor(params: DownloadTaskParams) {
    // 明确赋值必填参数
    this.illust_id = params.illust_id;
    this.status = params.status;
    this.create_time = params.create_time;
    this.update_time = params.update_time;
    this.retry_time = params.retry_time;

    // 赋值可选参数
    this.last_run_time = params.last_run_time;
    this.last_run_error = params.last_run_error;
  }

  static createTask(illust_id: string): DownloadTask {
    return new DownloadTask({
      illust_id,
      status: DownloadTaskStatus.Pending,
      create_time: new Date(),
      update_time: new Date(),
      retry_time: 0,
    });
  }

  // 开始下载
  startToDownload(): DownloadTask {
    this.last_run_error = "";
    this.last_run_time = new Date();
    this.update_time = new Date();
    this.retry_time++;
    this.status = DownloadTaskStatus.Running;
    return this;
  }

  // 下载成功
  success(): DownloadTask {
    this.last_run_error = "";
    this.update_time = new Date();
    this.status = DownloadTaskStatus.Success;
    return this;
  }

  // 下载失败，如果失败次数超过最大值，设置为死信
  fail(err?: Error): DownloadTask {
    if (err) {
      this.last_run_error = err.message;
    }
    this.update_time = new Date();
    if (this.retry_time >= DownloadTask.MaxRetryTime) {
      this.status = DownloadTaskStatus.Dead;
    } else {
      this.status = DownloadTaskStatus.Fail;
    }
    return this;
  }
}

// 额外信息
export interface Extra {
  zh: string; // 中文翻译提示
  en: string; // 英文翻译提示
}

// 翻译词条
export interface TranslateWord {
  origin: string; // 原字段
  translation?: string; // 翻译
  has_translate: boolean; // 是否已翻译
  extra_info?: Extra; // 额外信息
}

// 图片上传请求参数
export interface UploadImgV2Req {
  pixiv_name: string; // Pixiv 图片名称
  need_download: boolean; // 是否需要下载
  author: string; // 作者名称
  author_id?: string; // 作者 ID，可能为空
  is_r18: boolean; // 是否为 R18 内容
  title: string; // 图片标题
}

// Bangumi Character 相关类型
export interface BangumiCharacter {
  _id?: string; // MongoDB 文档 ID
  id: number; // Bangumi 角色 ID
  name: string;
  type: number; // 1=角色, 2=机体, 3=舰船, 4=组织
  summary: string;
  images?: {
    large: string;
    medium: string;
    small: string;
    grid: string;
  };
  locked: boolean;
  infobox?: Array<{
    key: string;
    value: string | Array<{
      k?: string;
      v: string;
    }>;
  }>;
  gender?: string;
  blood_type?: number; // 1=A, 2=B, 3=AB, 4=O
  birth_year?: number;
  birth_mon?: number;
  birth_day?: number;
  stat: {
    comments: number;
    collects: number;
  };
  created_at: Date;
  updated_at: Date;
}

// Subject关联的角色信息（简化版）
export interface SubjectCharacter {
  id: number;
  name: string;
  relation?: string; // 角色关系描述
}

// Bangumi Subject 相关类型
export interface BangumiSubject {
  _id?: string; // MongoDB 文档 ID
  id: number; // Bangumi 条目 ID
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  date?: string;
  platform: string;
  images: {
    large: string;
    common: string;
    medium: string;
    small: string;
    grid: string;
  };
  rating: {
    rank: number;
    score: number;
    total: number;
    count: Record<string, number>;
  };
  collection: {
    wish: number;
    collect: number;
    doing: number;
    on_hold: number;
    dropped: number;
  };
  tags: Array<{
    name: string;
    count: number;
  }>;
  eps: number;
  total_episodes: number;
  volumes: number;
  locked: boolean;
  nsfw: boolean;
  series: boolean;
  meta_tags: string[];
  infobox?: Array<{
    key: string;
    value: string | Array<{
      k?: string;
      v: string;
    }>;
  }>;
  characters: SubjectCharacter[]; // 新增：关联的角色列表
  created_at: Date;
  updated_at: Date;
}
