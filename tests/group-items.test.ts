import { describe, test, expect } from 'vitest';
import { groupItemsByStore } from '@/utils/group-items';
import type { Item } from '@/types/item';
import type { Store } from '@/types/store';

const markets: Store[] = [
  { id: 'hm', name: '盒马' },
  { id: 'cc', name: '菜场' },
  { id: 'none', name: '未指定店铺' },
];

function mk(overrides: Partial<Item>): Item {
  return {
    id: 'id', list_id: 'L', name: 'X',
    note: '', quantity: '',
    supermarket: 'none', category: '其他', category_emoji: '📦',
    checked: false, checked_at: null,
    created_by: 'o', created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z',
    ...overrides
  } as Item;
}

describe('groupItemsByStore', () => {
  test('空清单返回空数组', () => {
    expect(groupItemsByStore([], markets)).toEqual([]);
  });

  test('按店铺分组，店铺顺序与 stores 一致', () => {
    const items = [
      mk({ id: '1', supermarket: 'cc' }),
      mk({ id: '2', supermarket: 'hm' })
    ];
    const g = groupItemsByStore(items, markets);
    expect(g.length).toBe(2);
    expect(g[0].store.id).toBe('hm');
    expect(g[1].store.id).toBe('cc');
  });

  test('未知 supermarket id 归入"未指定店铺"组并共享到指定店铺', () => {
    const items = [mk({ id: '1', supermarket: 'ghost-market' })];
    const g = groupItemsByStore(items, markets);
    expect(g).toHaveLength(3);
    expect(g[2].store.id).toBe('none');
    expect(g[0].items).toHaveLength(1);
    expect(g[1].items).toHaveLength(1);
  });

  test('只返回有物品的店铺组', () => {
    const items = [mk({ id: '1', supermarket: 'hm' })];
    const g = groupItemsByStore(items, markets);
    expect(g.length).toBe(1);
    expect(g[0].store.id).toBe('hm');
  });

  test('每个店铺组返回 totalCount', () => {
    const items = [
      mk({ id: '1', supermarket: 'hm' }),
      mk({ id: '2', supermarket: 'hm' }),
      mk({ id: '3', supermarket: 'cc' })
    ];
    const g = groupItemsByStore(items, markets);
    expect(g.find(x => x.store.id === 'hm')!.totalCount).toBe(2);
    expect(g.find(x => x.store.id === 'cc')!.totalCount).toBe(1);
  });
});
