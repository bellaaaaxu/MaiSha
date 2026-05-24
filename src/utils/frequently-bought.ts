import type { PurchaseHistory } from '@/types/purchase-history';

export interface FrequentlyBoughtItem {
  name: string;
  category: string;
  category_emoji: string;
  count: number;
}

export function calculateFrequentlyBought(
  history: PurchaseHistory[],
  limit: number
): FrequentlyBoughtItem[] {
  const counts = new Map<string, { category: string; emoji: string; count: number }>();

  for (const record of history) {
    const seen = new Set<string>();
    for (const item of record.items_snapshot) {
      if (!item.checked) continue;
      if (seen.has(item.name)) continue;
      seen.add(item.name);

      const existing = counts.get(item.name);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(item.name, { category: item.category, emoji: item.category_emoji, count: 1 });
      }
    }
  }

  const MIN_COUNT = 3;
  return Array.from(counts.entries())
    .filter(([, v]) => v.count >= MIN_COUNT)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, v]) => ({
      name,
      category: v.category,
      category_emoji: v.emoji,
      count: v.count,
    }));
}
