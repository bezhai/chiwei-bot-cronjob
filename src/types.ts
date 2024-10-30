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
