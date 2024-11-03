// 定义通用的响应结构接口
interface PixivGenericResponse<T> {
  error: boolean;
  message: string;
  body?: T;
}

// FollowerInfo 包含了用户的基本信息
interface FollowerInfo {
  userId: string;
  userName: string;
}

// FollowerBody 包含了用户关注的总数和用户列表
interface FollowerBody {
  total: number;
  users: FollowerInfo[];
}

interface AuthorArtworkResponseBody {
  illusts: Record<string, any>;
}

// 定义单个作品的详细信息
interface IllustDetail {
  id: string;
}

// 定义标签搜索响应体
interface TagArtworkResponseBody {
  illust: {
    data: IllustDetail[]; // 数据是 IllustDetail 数组
  };
}

// 定义 IllustData 类，包含多个 IllustDetail，并提供 getIDs 方法
class IllustData {
  data: IllustDetail[];

  constructor(data: IllustDetail[]) {
    this.data = data;
  }

  // 获取 data 中所有 IllustDetail 的 ID
  getIDs(): string[] {
    return this.data.map((detail) => detail.id);
  }
}