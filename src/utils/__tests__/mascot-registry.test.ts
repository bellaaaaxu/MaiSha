import { describe, it, expect } from 'vitest';
import {
  MASCOT_MEMBERS,
  assignMascot,
  mascotUrl,
  type MascotMember,
} from '@/utils/mascot-registry';

describe('mascot-registry', () => {
  it('同一商品名永远同一只脸（稳定）', () => {
    const a = assignMascot('老干妈辣酱');
    const b = assignMascot('老干妈辣酱');
    expect(a.id).toBe(b.id);
  });

  it('繁简归一到同一只脸', () => {
    expect(assignMascot('雞蛋餅').id).toBe(assignMascot('鸡蛋饼').id);
  });

  it('扩池不换脸：加新成员后，老名字要么保持原脸、要么换到新成员', () => {
    const names = Array.from({ length: 200 }, (_, i) => `商品${i}号`);
    const before = new Map(names.map(n => [n, assignMascot(n).id]));
    const grown: MascotMember[] = [
      ...MASCOT_MEMBERS,
      { id: 'roujiamo', file: 'roujiamo', name: '肉夹馍', weight: 1 },
    ];
    for (const n of names) {
      const after = assignMascot(n, grown).id;
      expect([before.get(n), 'roujiamo']).toContain(after);
    }
  });

  it('队长 weight=2，分配份额约为普通成员两倍', () => {
    const names = Array.from({ length: 3000 }, (_, i) => `item-${i}-测试`);
    const counts = new Map<string, number>();
    for (const n of names) {
      const id = assignMascot(n).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const captain = counts.get('xiaorongbao') ?? 0;
    const others = MASCOT_MEMBERS.filter(m => m.id !== 'xiaorongbao');
    const avgOther =
      others.reduce((s, m) => s + (counts.get(m.id) ?? 0), 0) / others.length;
    expect(captain).toBeGreaterThan(avgOther * 1.4);
    expect(captain).toBeLessThan(avgOther * 2.8);
  });

  it('mascotUrl 指向 public/mascots', () => {
    expect(mascotUrl(MASCOT_MEMBERS[0])).toMatch(/^\/mascots\/.+\.webp$/);
  });
});
