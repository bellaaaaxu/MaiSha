import { describe, it, expect } from 'vitest';
import { haversineMeters, selectSearchTerms } from '../store-finder-utils';

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
