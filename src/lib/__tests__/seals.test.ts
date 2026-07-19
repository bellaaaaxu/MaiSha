import { describe, it, expect } from 'vitest';
import { pickSeal, RESIDENT_SEALS, SEASONAL_SEALS } from '@/lib/seals';

const none = new Set<string>();

describe('pickSeal', () => {
  it('非窗口期：均匀随机常驻 8（rand 注入可控）', () => {
    const now = new Date('2026-04-20');           // 无窗
    expect(pickSeal(none, now, () => 0)).toBe(RESIDENT_SEALS[0]);
    expect(pickSeal(none, now, () => 0.99)).toBe(RESIDENT_SEALS[7]);
  });

  it('窗口期未拥有：必得季节印', () => {
    expect(pickSeal(none, new Date('2026-09-20'), () => 0.99)).toBe('gui');
    expect(pickSeal(none, new Date('2026-07-01'), () => 0.99)).toBe('he');
    expect(pickSeal(none, new Date('2026-02-10'), () => 0.99)).toBe('shuixian');
  });

  it('梅窗跨年：12 月与 1 月都命中', () => {
    expect(pickSeal(none, new Date('2026-12-15'), () => 0.99)).toBe('mei');
    expect(pickSeal(none, new Date('2027-01-20'), () => 0.99)).toBe('mei');
    expect(pickSeal(none, new Date('2027-02-10'), () => 0.99)).toBe('shuixian'); // 已出梅窗
  });

  it('窗口期已拥有：50% 再钤季节印 / 50% 落常驻', () => {
    const owned = new Set(['gui']);
    const now = new Date('2026-09-20');
    expect(pickSeal(owned, now, () => 0.4)).toBe('gui');          // <0.5 再钤
    expect(pickSeal(owned, now, () => 0.6)).toBe('yinxing');  // ≥0.5 落常驻，RESIDENT_SEALS[4]
  });

  it('花名册完整且互斥', () => {
    expect(RESIDENT_SEALS).toHaveLength(8);
    expect(SEASONAL_SEALS.map(s => s.id)).toEqual(['shuixian', 'he', 'gui', 'mei']);
    expect(RESIDENT_SEALS.some(r => SEASONAL_SEALS.find(s => s.id === r))).toBe(false);
  });
});
