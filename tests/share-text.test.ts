import { describe, test, expect } from 'vitest';
import { generateShareText } from '@/utils/share-text';
import type { Item } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';

const markets: Supermarket[] = [
  { id: 'hm', name: '盒马', emoji: '🛒' },
  { id: 'cc', name: '菜场', emoji: '🥬' },
  { id: 'none', name: '未分类', emoji: '❓' }
];

function mk(o: Partial<Item>): Item {
  return {
    id: 'id', list_id: 'L', name: 'X',
    note: '', quantity: '',
    supermarket: 'none', category: '其他', category_emoji: '📦',
    checked: false, checked_at: null,
    created_by: 'o', created_at: '2026-04-23T00:00:00Z', updated_at: '2026-04-23T00:00:00Z',
    ...o
  } as Item;
}

describe('generateShareText', () => {
  test('空清单返回友好提示', () => {
    const t = generateShareText([], markets, new Date(2026, 3, 23));
    expect(t).toContain('清单为空');
  });

  test('包含标题、日期、超市分组', () => {
    const items = [mk({ id: '1', name: '青菜', supermarket: 'cc' })];
    const t = generateShareText(items, markets, new Date(2026, 3, 23));
    expect(t).toContain('买啥');
    expect(t).toContain('4/23');
    expect(t).toContain('🥬 菜场');
    expect(t).toContain('青菜');
  });

  test('note 和 quantity 拼接显示', () => {
    const items = [mk({ id: '1', name: '牛奶', note: '伊利', quantity: '2瓶', supermarket: 'hm' })];
    const t = generateShareText(items, markets, new Date(2026, 3, 23));
    expect(t).toContain('牛奶 · 伊利 × 2瓶');
  });

  test('只包含未勾选物品', () => {
    const items = [
      mk({ id: '1', name: '青菜', supermarket: 'cc', checked: false }),
      mk({ id: '2', name: '土豆', supermarket: 'cc', checked: true })
    ];
    const t = generateShareText(items, markets, new Date(2026, 3, 23));
    expect(t).toContain('青菜');
    expect(t).not.toContain('土豆');
  });

  test('多个超市按 markets 顺序输出', () => {
    const items = [
      mk({ id: '1', name: '青菜', supermarket: 'cc' }),
      mk({ id: '2', name: '牛奶', supermarket: 'hm' })
    ];
    const t = generateShareText(items, markets, new Date(2026, 3, 23));
    expect(t.indexOf('🛒 盒马')).toBeLessThan(t.indexOf('🥬 菜场'));
  });
});
