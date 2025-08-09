import { bangumiRequest } from '../api/bangumi';

export interface SubjectQuery {
  type?: 1 | 2 | 3 | 4 | 6;
  limit?: number;
  offset?: number;
}

export interface Collection {
  collect: number;
  doing: number;
  dropped: number;
  on_hold: number;
  wish: number;
}

export interface Images {
  common: string;
  grid: string;
  large: string;
  medium: string;
  small: string;
}

export interface Item {
  key: string;
  value: string | Array<{
    k?: string;
    v: string;
  }>;
}

export interface Rating {
  count: {
    "1"?: number;
    "10"?: number;
    "2"?: number;
    "3"?: number;
    "4"?: number;
    "5"?: number;
    "6"?: number;
    "7"?: number;
    "8"?: number;
    "9"?: number;
  };
  rank: number;
  score: number;
  total: number;
}

export interface Tag {
  count: number;
  name: string;
}

export interface Subject {
  collection: Collection;
  date?: string;
  eps: number;
  id: number;
  images: Images;
  infobox?: Item[];
  locked: boolean;
  meta_tags: string[];
  name: string;
  name_cn: string;
  nsfw: boolean;
  platform: string;
  rating: Rating;
  series: boolean;
  summary: string;
  tags: Tag[];
  total_episodes: number;
  type: number;
  volumes: number;
}

export interface SubjectsResponse {
  data: Subject[];
  total: number;
  limit: number;
  offset: number;
}

export async function getSubjects(query: SubjectQuery = {}): Promise<SubjectsResponse> {
  const params: Record<string, any> = {};
  
  if (query.type !== undefined) {
    params.type = query.type;
  }
  if (query.limit !== undefined) {
    params.limit = query.limit;
  }
  if (query.offset !== undefined) {
    params.offset = query.offset;
  }

  return bangumiRequest({
    path: '/v0/subjects',
    method: 'GET',
    params
  });
}

export async function getSubjectsByType(
  type: 1 | 2 | 3 | 4 | 6,
  limit = 30,
  offset = 0
): Promise<SubjectsResponse> {
  return getSubjects({ type, limit, offset });
}

// 角色相关接口类型定义
export interface RelatedCharacter {
  id: number;
  name: string;
  type: number; // 1=角色, 2=机体, 3=舰船, 4=组织
  relation: string;
  images?: {
    large: string;
    medium: string;
    small: string;
    grid: string;
  };
  actors: Array<{
    id: number;
    name: string;
    type: number;
    career: string[];
    images?: {
      large: string;
      medium: string;
      small: string;
      grid: string;
    };
  }>;
}

export interface CharacterDetail {
  id: number;
  name: string;
  type: number;
  images?: {
    large: string;
    medium: string;
    small: string;
    grid: string;
  };
  summary: string;
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
}

/**
 * 获取条目关联的角色列表
 * @param subjectId - 条目ID
 * @returns 角色列表
 */
export async function getSubjectCharacters(subjectId: number): Promise<RelatedCharacter[]> {
  return bangumiRequest({
    path: `/v0/subjects/${subjectId}/characters`,
    method: 'GET'
  });
}

/**
 * 获取角色详细信息
 * @param characterId - 角色ID
 * @returns 角色详细信息
 */
export async function getCharacterDetail(characterId: number): Promise<CharacterDetail> {
  return bangumiRequest({
    path: `/v0/characters/${characterId}`,
    method: 'GET'
  });
}