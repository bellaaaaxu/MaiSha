import { describe, it, expect } from 'vitest';
import { haversineMeters, selectSearchTerms, dedupeAndRank, findMatchingStore } from '../store-finder-utils';
import type { StoreSearchResult } from '@/types/store-finder';
import type { Store } from '@/types/store';

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters({ lat: 31.23, lng: 121.47 }, { lat: 31.23, lng: 121.47 })).toBeLessThan(1);
  });

  it('computes a known distance (~1.11km per 0.01° latitude)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});

describe('selectSearchTerms', () => {
  const kw = [
    { term: '大型超市', tier: 3 },
    { term: '日系超市', tier: 1 },
    { term: '亚洲超市', tier: 2 },
    { term: 'Asian supermarket', tier: 2 },
    { term: 'Japanese grocery', tier: 1 },
  ];

  it('keeps only tier<=2, sorted by tier, capped', () => {
    expect(selectSearchTerms(kw, 4)).toEqual([
      '日系超市', 'Japanese grocery', '亚洲超市', 'Asian supermarket',
    ]);
  });

  it('falls back to all terms when none are tier<=2', () => {
    expect(selectSearchTerms([{ term: '超市', tier: 3 }], 4)).toEqual(['超市']);
  });

  it('dedups identical terms', () => {
    expect(selectSearchTerms([{ term: '超市', tier: 1 }, { term: '超市', tier: 2 }], 4)).toEqual(['超市']);
  });
});

describe('dedupeAndRank', () => {
  const user = { lat: 0, lng: 0 };
  const mk = (o: Partial<StoreSearchResult>): StoreSearchResult => ({
    name: 'X', lat: 0, lng: 0, address: '', matchedTerm: '超市', category: '', ...o,
  });

  it('attaches distance and sorts nearest first', () => {
    const out = dedupeAndRank([
      mk({ name: 'Far', lat: 0.02, lng: 0 }),
      mk({ name: 'Near', lat: 0.001, lng: 0 }),
    ], user);
    expect(out.map((s) => s.name)).toEqual(['Near', 'Far']);
    expect(out[0].distanceMeters).toBeGreaterThan(0);
  });

  it('drops same-name results within 50m of an already-kept one', () => {
    const out = dedupeAndRank([
      mk({ name: '大华超市', lat: 0.0001, lng: 0 }),
      mk({ name: '大华超市', lat: 0.0002, lng: 0 }), // ~22m away → dup
    ], user);
    expect(out).toHaveLength(1);
  });

  it('keeps same-name results that are far apart (different branches)', () => {
    const out = dedupeAndRank([
      mk({ name: '大华超市', lat: 0, lng: 0 }),
      mk({ name: '大华超市', lat: 0.05, lng: 0 }), // ~5.5km → different branch
    ], user);
    expect(out).toHaveLength(2);
  });
});

describe('findMatchingStore', () => {
  const existing: Store[] = [
    { id: 'sm_a', name: '大华超市', lat: 0, lng: 0 },
    { id: 'sm_b', name: 'Costco' },
  ];

  it('matches by normalized name', () => {
    expect(findMatchingStore({ name: '大华超市' }, existing)?.id).toBe('sm_a');
  });

  it('matches by coordinates within 80m even if name differs', () => {
    expect(findMatchingStore({ name: 'DaHua', lat: 0.0003, lng: 0 }, existing)?.id).toBe('sm_a');
  });

  it('returns null when neither name nor coords match', () => {
    expect(findMatchingStore({ name: 'T&T', lat: 1, lng: 1 }, existing)).toBeNull();
  });

  it('returns null when there are no existing stores', () => {
    expect(findMatchingStore({ name: '大华超市', lat: 0, lng: 0 }, [])).toBeNull();
  });
});
