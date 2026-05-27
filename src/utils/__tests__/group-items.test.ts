import { describe, it, expect } from 'vitest';
import { groupItemsByStore } from '../group-items';
import type { Item } from '@/types/item';
import type { Store } from '@/types/store';

const stores: Store[] = [
  { id: 'costco', name: 'Costco' },
  { id: 'ikea', name: 'IKEA' },
  { id: 'none', name: '未指定店铺' },
];

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: '1',
    list_id: 'list-1',
    name: 'Test',
    note: '',
    quantity: '',
    supermarket: 'costco',
    category: '其他',
    category_emoji: '📦',
    checked: false,
    checked_at: null,
    created_by: 'uid-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('groupItemsByStore', () => {
  it('groups items by store', () => {
    const items = [
      makeItem({ id: '1', name: 'Milk', supermarket: 'costco' }),
      makeItem({ id: '2', name: 'Eggs', supermarket: 'costco' }),
      makeItem({ id: '3', name: 'Lamp', supermarket: 'ikea' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result).toHaveLength(2);
    expect(result[0].store.id).toBe('costco');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].store.id).toBe('ikea');
    expect(result[1].items).toHaveLength(1);
  });

  it('puts unknown store items into fallback and shares to assigned stores', () => {
    const items = [
      makeItem({ id: '1', name: 'Mystery', supermarket: 'deleted-store' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result).toHaveLength(3);
    expect(result[0].store.id).toBe('costco');
    expect(result[0].items).toHaveLength(1);
    expect(result[2].store.id).toBe('none');
    expect(result[2].items).toHaveLength(1);
  });

  it('returns empty array when no items and includeEmpty is false', () => {
    expect(groupItemsByStore([], stores, false)).toEqual([]);
  });

  it('returns all stores when includeEmpty is true', () => {
    const result = groupItemsByStore([], stores, true);
    expect(result).toHaveLength(3);
    expect(result.every(g => g.items.length === 0)).toBe(true);
  });

  it('puts fallback store last', () => {
    const items = [
      makeItem({ id: '1', supermarket: 'none' }),
      makeItem({ id: '2', supermarket: 'costco' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result[result.length - 1].store.id).toBe('none');
  });
});
