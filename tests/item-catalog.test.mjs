import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIconPrompts } from '../scripts/lib/parse-icon-prompts.mjs';
import catalog from '../scripts/data/item-catalog.mjs';

describe('item-catalog', () => {
  it('every entry has name, stem, category', () => {
    const bad = catalog.filter(i => !i.name || !i.stem || !i.category);
    expect(bad).toEqual([]);
  });

  it('stems are [a-z0-9-]+ and unique within the catalog', () => {
    for (const i of catalog) expect(i.stem, i.name).toMatch(/^[a-z0-9-]+$/);
    const stems = catalog.map(i => i.stem);
    const dupes = stems.filter((s, idx) => stems.indexOf(s) !== idx);
    expect(dupes).toEqual([]);
  });

  it('no stem collides with icon-prompts.md', () => {
    const md = parseIconPrompts(readFileSync(resolve(process.cwd(), 'icon-prompts.md'), 'utf8'));
    const mdStems = new Set(md.map(i => i.stem));
    const overlap = catalog.filter(i => mdStems.has(i.stem)).map(i => i.stem);
    expect(overlap).toEqual([]);
  });

  it('is a substantial catalog', () => {
    expect(catalog.length).toBeGreaterThan(120);
  });
});
