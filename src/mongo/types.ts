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

export class DownloadTask {
  illustId: string;
  r18Index: number;
  status: DownloadTaskStatus;
  createTime: Date;
  updateTime: Date;
  retryTime: number;
  lastRunTime: Date;
  lastRunError: string;

  static MaxRetryTime = 3;

  constructor(illustId: string, r18Index: number) {
    this.illustId = illustId;
    this.r18Index = r18Index;
    this.status = DownloadTaskStatus.Pending;
    this.createTime = new Date();
    this.updateTime = new Date();
    this.retryTime = 0;
    this.lastRunTime = new Date();
    this.lastRunError = "";
  }

  // 开始下载
  startToDownload(): DownloadTask {
    this.lastRunError = "";
    this.lastRunTime = new Date();
    this.updateTime = new Date();
    this.retryTime++;
    this.status = DownloadTaskStatus.Running;
    return this;
  }

  // 下载成功
  success(): DownloadTask {
    this.lastRunError = "";
    this.updateTime = new Date();
    this.status = DownloadTaskStatus.Success;
    return this;
  }

  // 下载失败，如果失败次数超过最大值，设置为死信
  fail(err?: Error): DownloadTask {
    if (err) {
      this.lastRunError = err.message;
    }
    this.updateTime = new Date();
    if (this.retryTime >= DownloadTask.MaxRetryTime) {
      this.status = DownloadTaskStatus.Dead;
    } else {
      this.status = DownloadTaskStatus.Fail;
    }
    return this;
  }
}
