/** AI 返回的店类型关键词，tier 越小越专门。 */
export interface StoreTypeKeyword {
  term: string;
  tier: number; // 1=最专门 2=大类 3=兜底通用
}

/** 原生 StoreSearch 插件返回的单条原始 POI（未去重、无距离）。 */
export interface StoreSearchResult {
  name: string;
  lat: number;
  lng: number;
  address: string;
  matchedTerm: string;
  category: string;
}

/** 去重 + 排序后、带距离的店，用于结果页展示。 */
export interface RankedStore extends StoreSearchResult {
  distanceMeters: number;
}

/** 用户点选、准备落清单的店。 */
export interface FoundStore {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}
