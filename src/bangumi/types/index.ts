/**
 * Bangumi 类型定义
 * 集中管理所有 Bangumi 相关的类型定义
 */

// ============= API 相关类型 =============

export interface BangumiApiRequest {
  path: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: Record<string, any>;
}

export interface BangumiApiResponse<T = any> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============= Subject 相关类型 =============

export interface SubjectQuery {
  type?: SubjectType;
  limit?: number;
  offset?: number;
  month?: number;
  year?: number;
}

export enum SubjectType {
  Book = 1,      // 书籍
  Anime = 2,     // 动画
  Music = 3,     // 音乐
  Game = 4,      // 游戏
  Real = 6       // 三次元
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

export interface InfoboxItem {
  key: string;
  value: string | Array<{
    k?: string;
    v: string;
  }>;
}

export interface Rating {
  count: Record<string, number>;
  rank: number;
  score: number;
  total: number;
}

export interface Tag {
  count: number;
  name: string;
}

export interface Subject {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  date?: string;
  platform: string;
  images: Images;
  rating: Rating;
  collection: Collection;
  tags: Tag[];
  eps: number;
  total_episodes: number;
  volumes: number;
  locked: boolean;
  nsfw: boolean;
  series: boolean;
  meta_tags: string[];
  infobox?: InfoboxItem[];
}

// ============= Character 相关类型 =============

export enum CharacterType {
  Character = 1,  // 角色
  Mecha = 2,      // 机体
  Ship = 3,       // 舰船
  Organization = 4 // 组织
}

export enum BloodType {
  A = 1,
  B = 2,
  AB = 3,
  O = 4
}

export interface CharacterImages {
  large: string;
  medium: string;
  small: string;
  grid: string;
}

export interface CharacterStat {
  comments: number;
  collects: number;
}

export interface Character {
  id: number;
  name: string;
  type: CharacterType;
  summary: string;
  images?: CharacterImages;
  locked: boolean;
  infobox?: InfoboxItem[];
  gender?: string;
  blood_type?: BloodType;
  birth_year?: number;
  birth_mon?: number;
  birth_day?: number;
  stat: CharacterStat;
}

export interface RelatedCharacter extends Character {
  relation: string;
  actors: Array<{
    id: number;
    name: string;
    type: number;
    career: string[];
    images?: CharacterImages;
  }>;
}

export interface SubjectCharacter {
  id: number;
  name: string;
  relation?: string;
}

// ============= 数据库相关类型 =============

export interface BangumiSubjectDocument extends Subject {
  _id?: string;
  characters?: SubjectCharacter[];
  created_at: Date;
  updated_at: Date;
}

export interface BangumiCharacterDocument extends Character {
  _id?: string;
  created_at: Date;
  updated_at: Date;
}

// ============= 同步策略相关类型 =============

export interface SyncOptions {
  cooldownDays: number;
  batchSize?: number;
  skipCharacters?: boolean;
}

export interface SyncResult {
  subjectsProcessed: number;
  charactersProcessed: number;
  errors: Array<{
    id: number;
    error: string;
  }>;
  duration: number;
}

export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
}