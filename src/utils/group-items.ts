import type { Item } from '@/types/item';
import type { Store } from '@/types/store';
import { UNDELETABLE_STORE_ID } from './constants';

export interface StoreGroup {
  store: Store;
  items: Item[];
  totalCount: number;
}

export function groupItemsByStore(
  items: Item[],
  stores: Store[],
  includeEmpty = false
): StoreGroup[] {
  if (!items.length && !includeEmpty) return [];

  const sorted = [
    ...stores.filter(s => s.id !== UNDELETABLE_STORE_ID),
    ...stores.filter(s => s.id === UNDELETABLE_STORE_ID),
  ];
  const validIds = new Set(sorted.map(s => s.id));
  const storeMap = new Map(sorted.map(s => [s.id, s]));

  const byStore = new Map<string, Item[]>();
  for (const item of items) {
    const sid = validIds.has(item.supermarket) ? item.supermarket : UNDELETABLE_STORE_ID;
    if (!byStore.has(sid)) byStore.set(sid, []);
    byStore.get(sid)!.push(item);
  }

  const unassignedUnchecked = (byStore.get(UNDELETABLE_STORE_ID) ?? []).filter(i => !i.checked);

  const out: StoreGroup[] = [];
  for (const s of sorted) {
    const bucket = byStore.get(s.id) ?? [];
    const isUnassigned = s.id === UNDELETABLE_STORE_ID;
    const combined = isUnassigned ? bucket : [...bucket, ...unassignedUnchecked];
    if (!combined.length) {
      if (includeEmpty) {
        out.push({ store: storeMap.get(s.id)!, items: [], totalCount: 0 });
      }
      continue;
    }
    out.push({ store: storeMap.get(s.id)!, items: combined, totalCount: combined.length });
  }
  return out;
}
