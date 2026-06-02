import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIconPrompts, cleanCategory } from '../scripts/lib/parse-icon-prompts.mjs';

const SAMPLE = `# 买啥 App 图标生成 Prompt 清单

> 工具：Gemini

## 蔬菜

### 1. 娃娃菜 (baby-cabbage)
\`\`\`
生成一个手绘素描+柔和上色风格的食材图标：

物品：一颗娃娃菜，嫩黄绿色
风格要求：
- 纯白背景，物体居中
\`\`\`

### 2. 西红柿 (tomato)
\`\`\`
物品：两个红色西红柿
\`\`\`

## 🆕 水果（新增类别）

### 57. 苹果 (apple)
\`\`\`
物品：一个红苹果
\`\`\`
`;

describe('cleanCategory', () => {
  it('strips the 🆕 prefix and （…）suffix', () => {
    expect(cleanCategory('🆕 水果（新增类别）')).toBe('水果');
    expect(cleanCategory('🆕 蔬菜补充（新增）')).toBe('蔬菜补充');
    expect(cleanCategory('蔬菜')).toBe('蔬菜');
    expect(cleanCategory('日用品')).toBe('日用品');
  });
});

describe('parseIconPrompts (sample)', () => {
  const items = parseIconPrompts(SAMPLE);

  it('parses every item and ignores the title/quote', () => {
    expect(items).toHaveLength(3);
  });

  it('captures index, name, stem and the current category', () => {
    expect(items[0]).toMatchObject({ index: 1, name: '娃娃菜', stem: 'baby-cabbage', category: '蔬菜' });
    expect(items[1]).toMatchObject({ index: 2, name: '西红柿', stem: 'tomato', category: '蔬菜' });
    expect(items[2]).toMatchObject({ index: 57, name: '苹果', stem: 'apple', category: '水果' });
  });

  it('captures the fenced prompt body, trimmed, without fences', () => {
    expect(items[0].prompt.startsWith('生成一个')).toBe(true);
    expect(items[0].prompt).toContain('物品：一颗娃娃菜');
    expect(items[0].prompt).toContain('纯白背景');
    expect(items[0].prompt).not.toContain('```');
  });
});

describe('letter-suffixed item numbers (e.g. 24a.)', () => {
  it('parses items numbered like 24a. (was silently skipped)', () => {
    const items = parseIconPrompts('## 调料\n\n### 24a. 老陈醋 (aged-vinegar)\n```\n物品：一瓶老陈醋\n```\n');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: '老陈醋', stem: 'aged-vinegar', category: '调料', index: 24 });
  });
});

describe('parseIconPrompts (real icon-prompts.md)', () => {
  const md = readFileSync(resolve(process.cwd(), 'icon-prompts.md'), 'utf8');
  const all = parseIconPrompts(md);

  it('parses a substantial number of items', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it('every stem is unique', () => {
    const stems = new Set(all.map(i => i.stem));
    expect(stems.size).toBe(all.length);
  });

  it('every item has a non-empty prompt and a category', () => {
    const bad = all.filter(i => !i.prompt || !i.category);
    expect(bad).toEqual([]);
  });
});
