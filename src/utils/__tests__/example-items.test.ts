import { describe, it, expect } from 'vitest';
import { buildExampleItems, relocalizeExampleItems } from '../example-items';

describe('buildExampleItems', () => {
  it('builds zh-CN seeds with hint on the first item only', () => {
    const rows = buildExampleItems('zh-CN', 'tnt');
    expect(rows.map(r => r.name)).toEqual(['鸡蛋', '牛奶', '西红柿']);
    expect(rows[0].note).toBe('去购物试试打勾');
    expect(rows[1].note).toBe('');
    expect(rows[2].note).toBe('');
    expect(rows.every(r => r.supermarket === 'tnt')).toBe(true);
  });

  it('builds zh-TW seeds with traditional names', () => {
    const rows = buildExampleItems('zh-TW', 'none');
    expect(rows.map(r => r.name)).toEqual(['雞蛋', '牛奶', '番茄']);
    expect(rows[0].note).toBe('去購物試試打勾');
  });

  it('builds en seeds', () => {
    const rows = buildExampleItems('en', 'costco');
    expect(rows.map(r => r.name)).toEqual(['Eggs', 'Milk', 'Tomatoes']);
    expect(rows[0].note).toBe('Check off in Shopping');
  });

  it('falls back to zh-CN for unknown or missing language', () => {
    expect(buildExampleItems(null, 'none')[0].name).toBe('鸡蛋');
    expect(buildExampleItems('fr', 'none')[0].name).toBe('鸡蛋');
  });
});

describe('relocalizeExampleItems', () => {
  it('英文种子切到 zh-CN：名字与提示都重写', () => {
    const items = [
      { id: '1', name: 'Eggs', note: 'Check off in Shopping' },
      { id: '2', name: 'Milk', note: '' },
      { id: '3', name: 'Tomatoes', note: '' },
    ];
    const patches = relocalizeExampleItems(items, 'zh-CN');
    expect(patches).toEqual([
      { id: '1', patch: { name: '鸡蛋', note: '去购物试试打勾' } },
      { id: '2', patch: { name: '牛奶' } },
      { id: '3', patch: { name: '西红柿' } },
    ]);
  });

  it('历史长文案提示也能被识别重写（升级前种下的清单）', () => {
    const items = [{ id: '1', name: 'Eggs', note: 'Tap the circle to check it off' }];
    expect(relocalizeExampleItems(items, 'zh-CN')).toEqual([
      { id: '1', patch: { name: '鸡蛋', note: '去购物试试打勾' } },
    ]);
  });

  it('用户改过名/自己加的商品不动', () => {
    const items = [
      { id: '1', name: 'Eggs & Bacon', note: '' },
      { id: '2', name: '老干妈辣酱', note: '' },
    ];
    expect(relocalizeExampleItems(items, 'zh-CN')).toEqual([]);
  });

  it('已是目标语言时不产生补丁', () => {
    const items = [{ id: '1', name: '鸡蛋', note: '去购物试试打勾' }];
    expect(relocalizeExampleItems(items, 'zh-CN')).toEqual([]);
  });

  it('繁简互切正常', () => {
    const items = [{ id: '1', name: '西红柿', note: '' }];
    expect(relocalizeExampleItems(items, 'zh-TW')).toEqual([
      { id: '1', patch: { name: '番茄' } },
    ]);
  });
});

describe('relocalizeExampleItems · 上一版短文案也算 legacy', () => {
  it('「点圆圈打勾」在同语言下也被升级为新提示', () => {
    const items = [{ id: '1', name: '鸡蛋', note: '点圆圈打勾' }];
    expect(relocalizeExampleItems(items, 'zh-CN')).toEqual([
      { id: '1', patch: { note: '去购物试试打勾' } },
    ]);
  });
});
