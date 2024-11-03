// 定义通用的响应结构接口
export interface PixivGenericResponse<T> {
  error: boolean;
  message: string;
  body?: T;
}

// FollowerInfo 包含了用户的基本信息
export interface FollowerInfo {
  userId: string;
  userName: string;
}

// FollowerBody 包含了用户关注的总数和用户列表
export interface FollowerBody {
  total: number;
  users: FollowerInfo[];
}

export interface AuthorArtworkResponseBody {
  illusts: Record<string, any>;
}

// 定义单个作品的详细信息
export interface IllustDetail {
  id: string;
}

// 定义标签搜索响应体
export interface TagArtworkResponseBody {
  illust: {
    data: IllustDetail[]; // 数据是 IllustDetail 数组
  };
}

// 定义 IllustData 类，包含多个 IllustDetail，并提供 getIDs 方法
export class IllustData {
  data: IllustDetail[];

  constructor(data: IllustDetail[]) {
    this.data = data;
  }

  // 获取 data 中所有 IllustDetail 的 ID
  getIDs(): string[] {
    return this.data.map((detail) => detail.id);
  }
}

export interface ImageUrls {
  thumb_mini: string;  // 保持与 Go 结构体字段名一致
  small: string;
  regular: string;
  original: string;
}

export interface IllustrationPageDetail {
  urls?: ImageUrls;  // 对应 Go 的指针类型，用 `?` 表示可选属性
  width: number;
  height: number;
}

export interface BaseResponse {
  code: number;
  msg: string;
  data?: any;
}