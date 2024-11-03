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
  illust_id: string;
  r18_index: number;
  status: DownloadTaskStatus;
  create_time: Date;
  update_time: Date;
  retry_time: number;
  last_run_time: Date;
  last_run_error: string;

  static MaxRetryTime = 3;

  constructor(illustId: string, r18Index: number) {
    this.illust_id = illustId;
    this.r18_index = r18Index;
    this.status = DownloadTaskStatus.Pending;
    this.create_time = new Date();
    this.update_time = new Date();
    this.retry_time = 0;
    this.last_run_time = new Date();
    this.last_run_error = "";
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
