import { describe, test, expect, beforeEach, vi } from 'vitest';
import { recordItemUsage, getTopFrequentItems } from '@/utils/frequent-items';

describe('frequent-items', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('第一次记录：count=1', () => {
    recordItemUsage('uid1', { name: '牛奶', note: '', supermarket: 'none', category_emoji: '🥛' });
    const top = getTopFrequentItems('uid1', 6);
    expect(top.length).toBe(1);
    expect(top[0].name).toBe('牛奶');
    expect(top[0].count).toBe(1);
  });

  test('第二次同聚合键：count=2', () => {
    recordItemUsage('uid1', { name: '牛奶', note: '', supermarket: 'none', category_emoji: '🥛' });
    recordItemUsage('uid1', { name: '牛奶', note: '', supermarket: 'none', category_emoji: '🥛' });
    const top = getTopFrequentItems('uid1', 6);
    expect(top.length).toBe(1);
    expect(top[0].count).toBe(2);
  });

  test('不同 note 视为不同聚合键', () => {
    recordItemUsage('uid1', { name: '牛奶', note: '伊利', supermarket: 'none', category_emoji: '🥛' });
    recordItemUsage('uid1', { name: '牛奶', note: '蒙牛', supermarket: 'none', category_emoji: '🥛' });
    expect(getTopFrequentItems('uid1', 6).length).toBe(2);
  });

  test('不同 supermarket 视为不同聚合键', () => {
    recordItemUsage('uid1', { name: '牛奶', note: '', supermarket: 'hm', category_emoji: '🥛' });
    recordItemUsage('uid1', { name: '牛奶', note: '', supermarket: 'jd', category_emoji: '🥛' });
    expect(getTopFrequentItems('uid1', 6).length).toBe(2);
  });

  test('返回按 count desc 排序', () => {
    recordItemUsage('uid1', { name: 'A', note: '', supermarket: 'none', category_emoji: '📦' });
    recordItemUsage('uid1', { name: 'B', note: '', supermarket: 'none', category_emoji: '📦' });
    recordItemUsage('uid1', { name: 'B', note: '', supermarket: 'none', category_emoji: '📦' });
    recordItemUsage('uid1', { name: 'B', note: '', supermarket: 'none', category_emoji: '📦' });
    const top = getTopFrequentItems('uid1', 6);
    expect(top[0].name).toBe('B');
    expect(top[1].name).toBe('A');
  });

  test('count 相同时 lastUsedAt desc 优先', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    recordItemUsage('uid1', { name: 'A', note: '', supermarket: 'none', category_emoji: '📦' });
    vi.setSystemTime(2000);
    recordItemUsage('uid1', { name: 'B', note: '', supermarket: 'none', category_emoji: '📦' });
    const top = getTopFrequentItems('uid1', 6);
    expect(top[0].name).toBe('B');
    vi.useRealTimers();
  });

  test('limit 参数生效', () => {
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      recordItemUsage('uid1', { name: n, note: '', supermarket: 'none', category_emoji: '📦' });
    }
    expect(getTopFrequentItems('uid1', 3).length).toBe(3);
  });

  test('不同 uid 各自独立', () => {
    recordItemUsage('uid1', { name: 'A', note: '', supermarket: 'none', category_emoji: '📦' });
    recordItemUsage('uid2', { name: 'B', note: '', supermarket: 'none', category_emoji: '📦' });
    expect(getTopFrequentItems('uid1', 6)[0].name).toBe('A');
    expect(getTopFrequentItems('uid2', 6)[0].name).toBe('B');
  });
});
