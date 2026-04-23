import type { Item, CategoryKey } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';
import { UNDELETABLE_SUPERMARKET_ID } from './constants';

export interface CategoryGroup {
  category: CategoryKey;
  emoji: string;
  items: Item[];
}

export interface MarketGroup {
  supermarket: Supermarket;
  categories: CategoryGroup[];
  totalCount: number;
}

export function groupItemsByMarketAndCategory(
  items: Item[],
  supermarkets: Supermarket[]
): MarketGroup[] {
  if (!items.length) return [];

  const validIds = new Set(supermarkets.map(s => s.id));
  const fallbackId = UNDELETABLE_SUPERMARKET_ID;
  const marketMap = new Map(supermarkets.map(s => [s.id, s]));

  const byMarket = new Map<string, Item[]>();
  for (const it of items) {
    const mid = validIds.has(it.supermarket) ? it.supermarket : fallbackId;
    if (!byMarket.has(mid)) byMarket.set(mid, []);
    byMarket.get(mid)!.push(it);
  }

  const out: MarketGroup[] = [];
  for (const s of supermarkets) {
    const bucket = byMarket.get(s.id);
    if (!bucket || !bucket.length) continue;

    const catOrder: CategoryKey[] = [];
    const catMap = new Map<CategoryKey, CategoryGroup>();
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
