import { registerPlugin } from '@capacitor/core';
import type { StoreSearchResult } from '@/types/store-finder';

export interface StoreSearchPlugin {
  search(options: { queries: string[]; lat: number; lng: number }): Promise<{ results: StoreSearchResult[] }>;
}

export const StoreSearch = registerPlugin<StoreSearchPlugin>('StoreSearch', {
  web: () => import('./store-search-web').then((m) => new m.StoreSearchWeb()),
});
