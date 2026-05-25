import type { Item } from '@/types/item';
import type { Store } from '@/types/store';
import { UNDELETABLE_SUPERMARKET_ID } from './constants';

export interface CategoryGroup {
  category: string;
  emoji: string;
  items: Item[];
}

export interface MarketGroup {
  supermarket: Store;
  categories: CategoryGroup[];
  totalCount: number;
}

export function groupItemsByMarketAndCategory(
  items: Item[],
  supermarkets: Store[],
  includeEmpty = false
): MarketGroup[] {
  if (!items.length && !includeEmpty) return [];

  // Always render "未分类" (fallback) at the bottom regardless of stored order
  const sortedMarkets = [
    ...supermarkets.filter(s => s.id !== UNDELETABLE_SUPERMARKET_ID),
    ...supermarkets.filter(s => s.id === UNDELETABLE_SUPERMARKET_ID),
  ];
  const validIds = new Set(sortedMarkets.map(s => s.id));
  const fallbackId = UNDELETABLE_SUPERMARKET_ID;
  const marketMap = new Map(sortedMarkets.map(s => [s.id, s]));

  const byMarket = new Map<string, Item[]>();
  for (const it of items) {
    const mid = validIds.has(it.supermarket) ? it.supermarket : fallbackId;
    if (!byMarket.has(mid)) byMarket.set(mid, []);
    byMarket.get(mid)!.push(it);
  }

  const out: MarketGroup[] = [];
  for (const s of sortedMarkets) {
    const bucket = byMarket.get(s.id);
    if (!bucket || !bucket.length) {
      if (includeEmpty) {
        out.push({
          supermarket: marketMap.get(s.id)!,
          categories: [],
          totalCount: 0
        });
      }
      continue;
    }

    const catOrder: string[] = [];
    const catMap = new Map<string, CategoryGroup>();
    for (const it of bucket) {
      if (!catMap.has(it.category)) {
        catOrder.push(it.category);
        catMap.set(it.category, { category: it.category, emoji: it.category_emoji, items: [] });
      }
      catMap.get(it.category)!.items.push(it);
    }

    out.push({
      supermarket: marketMap.get(s.id)!,
      categories: catOrder.map(k => catMap.get(k)!),
      totalCount: bucket.length
    });
  }
  return out;
}
