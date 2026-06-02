import { describe, it, expect } from 'vitest';
import { getIconPath, resolveIconUrl } from '../icon-registry';

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
