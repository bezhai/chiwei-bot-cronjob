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