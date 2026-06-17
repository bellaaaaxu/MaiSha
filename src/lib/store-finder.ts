import { supabase } from './supabase';
import { updateListSupermarkets, addItem } from './db';
import { selectSearchTerms, dedupeAndRank, findMatchingStore } from './store-finder-utils';
import { StoreSearch } from './store-search-plugin';
import type { List } from '@/types/list';
import type { Store } from '@/types/store';
import type { StoreTypeKeyword, RankedStore, FoundStore } from '@/types/store-finder';

const FALLBACK: StoreTypeKeyword[] = [
  { term: '超市', tier: 3 },
  { term: 'supermarket', tier: 3 },
];

/** 商品 → 店类型关键词（走 Edge Function；失败降级通用词）。 */
export async function resolveStoreTypes(name: string): Promise<StoreTypeKeyword[]> {
  const { data: { session } } = await supabase.auth.getSession();
  // Intentional throw: the feature is iOS-gated and always authenticated, so a
  // missing session is an exceptional state, not a degradation case. Callers
  // (findStoresFor → StoreFinder.tsx) run inside a try/catch.
  if (!session) throw new Error('Not authenticated');
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-store-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return Array.isArray(data.keywords) && data.keywords.length ? data.keywords : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** 用关键词在用户位置附近搜店，返回去重排序后的店列表。 */
export async function findStoresFor(name: string, loc: { lat: number; lng: number }): Promise<RankedStore[]> {
  const keywords = await resolveStoreTypes(name);
  const terms = selectSearchTerms(keywords, 4);
  const { results } = await StoreSearch.search({ queries: terms, lat: loc.lat, lng: loc.lng });

  // Drop results with invalid coordinates before ranking.
  // The native bridge defaults missing coords to (0,0) — a real point off the
  // coast of Africa — which would pollute distance ranking. Non-finite values
  // (NaN, Infinity) can also arrive from malformed MapKit responses.
  const validResults = results.filter(
    (r) => !(r.lat === 0 && r.lng === 0) && Number.isFinite(r.lat) && Number.isFinite(r.lng)
  );

  return dedupeAndRank(validResults, loc);
}

/** 点选一家店：已有则复用，否则加进清单的超市，再把商品加到该店。 */
export async function commitStoreChoice(
  list: List,
  uid: string,
  productName: string,
  chosen: FoundStore
): Promise<void> {
  const existing: Store[] = list.supermarkets ?? [];
  let store = findMatchingStore(chosen, existing);
  if (!store) {
    store = {
      id: 'sm_' + Date.now().toString(36),
      name: chosen.name,
      lat: chosen.lat,
      lng: chosen.lng,
      address: chosen.address,
    };
    await updateListSupermarkets(list.id, [...existing, store]);
  }
  await addItem(list.id, uid, { name: productName, supermarket: store.id });
}
