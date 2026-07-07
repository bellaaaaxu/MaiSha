import { describe, it, expect } from 'vitest';
import {
  DECOR_MEMBERS,
  assignDecor,
  decorUrl,
  type DecorMember,
} from '@/utils/decor-registry';

describe('decor-registry', () => {
  it('同一商品名永远同一张贴纸（稳定）', () => {
    expect(assignDecor('老干妈辣酱').id).toBe(assignDecor('老干妈辣酱').id);
  });

  it('繁简归一到同一张贴纸', () => {
    expect(assignDecor('雞蛋餅').id).toBe(assignDecor('鸡蛋饼').id);
  });

  it('花名册 12 只且等权重', () => {
    expect(DECOR_MEMBERS).toHaveLength(12);
    expect(DECOR_MEMBERS.every(m => m.weight === 1)).toBe(true);
  });

  it('扩池不洗牌：加新成员后老名字要么原贴纸要么归新成员', () => {
    const names = Array.from({ length: 200 }, (_, i) => `商品${i}号`);
    const before = new Map(names.map(n => [n, assignDecor(n).id]));
    const grown: DecorMember[] = [
      ...DECOR_MEMBERS,
      { id: 'shanchahua', file: 'shanchahua', name: '山茶', weight: 1 },
    ];
    for (const n of names) {
      expect([before.get(n), 'shanchahua']).toContain(assignDecor(n, grown).id);
    }
  });

  it('等权重分布大致均匀（每只 ≈ 1/12）', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const id = assignDecor(`item-${i}-测试`).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const m of DECOR_MEMBERS) {
      const c = counts.get(m.id) ?? 0;
      expect(c).toBeGreaterThan(150);
      expect(c).toBeLessThan(400);
    }
  });

  it('decorUrl 指向 public/flora', () => {
    expect(decorUrl(DECOR_MEMBERS[0])).toMatch(/^\/flora\/.+\.webp$/);
  });
});
