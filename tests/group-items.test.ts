import { describe, test, expect } from 'vitest';
import { groupItemsByMarketAndCategory } from '@/utils/group-items';
import type { Item } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';

const markets: Supermarket[] = [
  { id: 'hm', name: '盒马', emoji: '🛒' },
  { id: 'cc', name: '菜场', emoji: '🥬' },
  { id: 'none', name: '未分类', emoji: '❓' }
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

describe('groupItemsByMarketAndCategory', () => {
  test('空清单返回空数组', () => {
    expect(groupItemsByMarketAndCategory([], markets)).toEqual([]);
  });

  test('按超市分组，超市顺序与 markets 一致', () => {
    const items = [
      mk({ id: '1', supermarket: 'cc', category: '蔬菜', category_emoji: '🥬' }),
      mk({ id: '2', supermarket: 'hm', category: '乳制品', category_emoji: '🥛' })
    ];
    const g = groupItemsByMarketAndCategory(items, markets);
    expect(g.length).toBe(2);
    expect(g[0].supermarket.id).toBe('hm');
    expect(g[1].supermarket.id).toBe('cc');
  });

  test('超市下按品类副分组', () => {
    const items = [
      mk({ id: '1', supermarket: 'cc', category: '蔬菜', category_emoji: '🥬' }),
      mk({ id: '2', supermarket: 'cc', category: '蔬菜', category_emoji: '🥬' }),
      mk({ id: '3', supermarket: 'cc', category: '肉蛋', category_emoji: '🥩' })
    ];
    const g = groupItemsByMarketAndCategory(items, markets);
    expect(g[0].categories.length).toBe(2);
    expect(g[0].categories[0].category).toBe('蔬菜');
    expect(g[0].categories[0].items.length).toBe(2);
    expect(g[0].categories[1].category).toBe('肉蛋');
  });

  test('未知 supermarket id 归入"未分类"组', () => {
    const items = [mk({ id: '1', supermarket: 'ghost-market' })];
    const g = groupItemsByMarketAndCategory(items, markets);
    expect(g[0].supermarket.id).toBe('none');
  });

  test('只返回有物品的超市组', () => {
    const items = [mk({ id: '1', supermarket: 'hm', category: '乳制品' })];
    const g = groupItemsByMarketAndCategory(items, markets);
    expect(g.length).toBe(1);
    expect(g[0].supermarket.id).toBe('hm');
  });

  test('每个超市组返回 totalCount', () => {
    const items = [
      mk({ id: '1', supermarket: 'hm' }),
      mk({ id: '2', supermarket: 'hm' }),
      mk({ id: '3', supermarket: 'cc' })
    ];
    const g = groupItemsByMarketAndCategory(items, markets);
    expect(g.find(x => x.supermarket.id === 'hm')!.totalCount).toBe(2);
    expect(g.find(x => x.supermarket.id === 'cc')!.totalCount).toBe(1);
  });
});
