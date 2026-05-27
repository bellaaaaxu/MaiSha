import type { FrequentlyBoughtItem } from './frequently-bought';
import type { FrequentItem } from './frequent-items';

export interface MergedFrequentItem {
  name: string;
  note: string;
  supermarket: string;
}

export function mergeFrequentItems(
  historyItems: FrequentlyBoughtItem[],
  localItems: FrequentItem[],
  limit: number,
): MergedFrequentItem[] {
  const seen = new Set<string>();
  const result: MergedFrequentItem[] = [];

  const localByName = new Map(localItems.map(l => [l.name, l]));

  // History items first (higher signal — actual purchases)
  for (const h of historyItems) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    const local = localByName.get(h.name);
    result.push({
      name: h.name,
      note: local?.note ?? '',
      supermarket: local?.supermarket ?? 'none',
    });
  }

  // Then local-only items
  for (const l of localItems) {
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    result.push({
      name: l.name,
      note: l.note,
      supermarket: l.supermarket,
    });
  }

  return result.slice(0, limit);
}
