import { describe, it, expect } from 'vitest';
import { getIconPath, resolveIconUrl, matchesIconQuery } from '../icon-registry';

describe('getIconPath with normalization', () => {
  it('matches a simplified preset name', () => {
    // 辣椒酱 -> chili-sauce is a registered preset
    expect(getIconPath('辣椒酱')).toBe('/icons/chili-sauce.webp');
  });
  it('matches the traditional form to the same preset (醬 -> 酱)', () => {
    expect(getIconPath('辣椒醬')).toBe(getIconPath('辣椒酱'));
    expect(getIconPath('辣椒醬')).not.toBeNull();
  });
});

describe('resolveIconUrl with normalization', () => {
  it('finds a custom icon whose key was stored normalized', () => {
    const map = new Map<string, string>([['辣椒酱', 'https://x/sauce.webp']]);
    // lookup with the traditional form should still hit
    expect(resolveIconUrl('辣椒醬', map)).toBe('https://x/sauce.webp');
  });
  it('returns null when nothing matches', () => {
    expect(resolveIconUrl('___nope___', new Map())).toBeNull();
  });
});

describe('matchesIconQuery', () => {
  it('empty query matches everything', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '')).toBe(true);
    expect(matchesIconQuery({ name: '辣椒酱' }, '   ')).toBe(true);
  });
  it('substring match on name', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '辣椒')).toBe(true);
    expect(matchesIconQuery({ name: '牛奶' }, '酱')).toBe(false);
  });
  it('normalizes simp/trad both sides', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '辣椒醬')).toBe(true);
  });
  it('matches aliases', () => {
    expect(matchesIconQuery({ name: '西红柿', aliases: ['番茄'] }, '番茄')).toBe(true);
  });
});
