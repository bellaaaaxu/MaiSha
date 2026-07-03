import { describe, it, expect } from 'vitest';
import { buildExampleItems } from '../example-items';

describe('buildExampleItems', () => {
  it('builds zh-CN seeds with hint on the first item only', () => {
    const rows = buildExampleItems('zh-CN', 'tnt');
    expect(rows.map(r => r.name)).toEqual(['鸡蛋', '牛奶', '西红柿']);
    expect(rows[0].note).toBe('点左边圆圈试试打勾');
    expect(rows[1].note).toBe('');
    expect(rows[2].note).toBe('');
    expect(rows.every(r => r.supermarket === 'tnt')).toBe(true);
  });

  it('builds zh-TW seeds with traditional names', () => {
    const rows = buildExampleItems('zh-TW', 'none');
    expect(rows.map(r => r.name)).toEqual(['雞蛋', '牛奶', '番茄']);
    expect(rows[0].note).toBe('點左邊圓圈試試打勾');
  });

  it('builds en seeds', () => {
    const rows = buildExampleItems('en', 'costco');
    expect(rows.map(r => r.name)).toEqual(['Eggs', 'Milk', 'Tomatoes']);
    expect(rows[0].note).toBe('Tap the circle to check it off');
  });

  it('falls back to zh-CN for unknown or missing language', () => {
    expect(buildExampleItems(null, 'none')[0].name).toBe('鸡蛋');
    expect(buildExampleItems('fr', 'none')[0].name).toBe('鸡蛋');
  });
});
