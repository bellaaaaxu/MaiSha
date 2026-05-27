import { describe, it, expect } from 'vitest';
import { mergeFrequentItems } from '../merge-frequent-items';
import type { FrequentlyBoughtItem } from '../frequently-bought';
import type { FrequentItem } from '../frequent-items';

describe('mergeFrequentItems', () => {
  it('merges items from both sources, deduplicated by name', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
      { name: '牛奶', category: '其他', category_emoji: '📦', count: 3 },
    ];
    const local: FrequentItem[] = [
      { name: '鸡蛋', note: '', supermarket: 'costco', category_emoji: '📦', count: 10, lastUsedAt: 1000 },
      { name: '面包', note: '', supermarket: 'none', category_emoji: '📦', count: 4, lastUsedAt: 900 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    const names = result.map(r => r.name);
    expect(names).toContain('鸡蛋');
    expect(names).toContain('牛奶');
    expect(names).toContain('面包');
    expect(names.filter(n => n === '鸡蛋')).toHaveLength(1);
  });

  it('respects the limit parameter', () => {
    const history: FrequentlyBoughtItem[] = Array.from({ length: 10 }, (_, i) => ({
      name: `item-${i}`, category: '其他', category_emoji: '📦', count: 10 - i,
    }));
    const result = mergeFrequentItems(history, [], 5);
    expect(result).toHaveLength(5);
  });

  it('prioritizes history items over local-only items', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
    ];
    const local: FrequentItem[] = [
      { name: '面包', note: '', supermarket: 'none', category_emoji: '📦', count: 100, lastUsedAt: 9999 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    expect(result[0].name).toBe('鸡蛋');
  });

  it('returns empty array when both sources are empty', () => {
    expect(mergeFrequentItems([], [], 8)).toEqual([]);
  });

  it('preserves note and supermarket from local data when available', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
    ];
    const local: FrequentItem[] = [
      { name: '鸡蛋', note: '土鸡蛋', supermarket: 'costco', category_emoji: '📦', count: 3, lastUsedAt: 1000 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    expect(result[0].note).toBe('土鸡蛋');
    expect(result[0].supermarket).toBe('costco');
  });
});
