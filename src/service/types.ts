export enum EnumIllustType {
  IllustUnknown = -1,
  IllustTypeJpg = 0,
  IllustTypeGif = 2,
}

export interface Translation {
  en?: string;
  zh?: string;
}

export interface Tags {
  tags: Tag[];
}

export interface Tag {
  tag: string;
  locked: boolean;
  deletable: boolean;
  user_id: string;
  user_name: string;
  translation?: Translation;
}

export interface GetIllustInfoBody {
  tags?: Tags;
  user_name: string;
  user_id: string;
  illust_title: string;
  illust_type: EnumIllustType;
}
