export enum EnumIllustType {
  IllustUnknown = -1,
  IllustTypeJpg = 0,
  IllustTypeGif = 2,
}

export class Translation {
  en: string = "";
  zh: string = "";

  constructor(data?: Partial<Translation>) {
    Object.assign(this, data);
  }

  getEn(): string {
    return this.en || "";
  }

  getZh(): string {
    return this.zh || "";
  }
}

export class Tags {
  tags: Tag[] = [];

  constructor(data?: Partial<Tags>) {
    Object.assign(this, data);
  }

  getTags(): Tag[] {
    return this.tags || [];
  }
}

export class Tag {
  tag: string = "";
  locked: boolean = false;
  deletable: boolean = false;
  user_id: string = "";
  user_name: string = "";
  translation?: Translation;

  constructor(data?: Partial<Tag>) {
    Object.assign(this, data);
  }

  getTag(): string {
    return this.tag || "";
  }

  isLocked(): boolean {
    return this.locked;
  }

  isDeletable(): boolean {
    return this.deletable;
  }

  getUserID(): string {
    return this.user_id || "";
  }

  getUserName(): string {
    return this.user_name || "";
  }

  getTranslation(): Translation {
    return this.translation || new Translation();
  }
}

export class GetIllustInfoBody {
  tags?: Tags;
  user_name: string = "";
  user_id: string = "";
  illust_title: string = "";
  illust_type: EnumIllustType = EnumIllustType.IllustUnknown;

  constructor(data?: Partial<GetIllustInfoBody>) {
    Object.assign(this, data);
  }

  // 方法来获取 Tags
  getTags(): Tags | undefined {
    return this?.tags;
  }

  getUserName(): string {
    return this.user_name || "";
  }

  getUserID(): string {
    return this.user_id || "";
  }

  getIllustTitle(): string {
    return this.illust_title || "";
  }

  getIllustType(): EnumIllustType {
    return this.illust_type || EnumIllustType.IllustUnknown;
  }
}
