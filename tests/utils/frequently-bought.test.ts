import { describe, it, expect } from 'vitest';
import { calculateFrequentlyBought } from '@/utils/frequently-bought';
import type { PurchaseHistory } from '@/types/purchase-history';

const makeHistory = (items: { name: string; checked: boolean }[], date: string): PurchaseHistory => ({
  id: crypto.randomUUID(),
  list_id: 'list1',
  supermarket_id: 'tnt',
  supermarket_name: 'T&T',
  items_snapshot: items.map(i => ({
    name: i.name, quantity: '', note: '', category: '其他', category_emoji: '📦', checked: i.checked,
  })),
  total_count: items.length,
  bought_count: items.filter(i => i.checked).length,
  amount: null,
  currency: 'CNY',
  completed_at: date,
});

describe('calculateFrequentlyBought', () => {
  it('returns items that appear 3+ times', () => {
    const history = [
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-01'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '面包', checked: true }], '2026-05-08'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-15'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-22'),
    ];
    const result = calculateFrequentlyBought(history, 8);
    expect(result[0].name).toBe('牛奶');
    expect(result[0].count).toBe(4);
    expect(result.find(r => r.name === '鸡蛋')?.count).toBe(3);
    expect(result.find(r => r.name === '面包')).toBeUndefined();
  });

  it('only counts checked (bought) items', () => {
    const history = [
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-01'),
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-08'),
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-15'),
    ];
    const result = calculateFrequentlyBought(history, 8);
    expect(result.find(r => r.name === '豆腐')).toBeUndefined();
  });

  it('respects limit', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ name: `item${i}`, checked: true }));
    const history = [
      makeHistory(items, '2026-05-01'),
      makeHistory(items, '2026-05-08'),
      makeHistory(items, '2026-05-15'),
    ];
    const result = calculateFrequentlyBought(history, 5);
    expect(result.length).toBe(5);
  });
});
