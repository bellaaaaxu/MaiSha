// tests/image-utils.test.ts
import { describe, test, expect } from 'vitest';
import { getAdaptiveLabel, detectLanguage, getMonogram } from '@/utils/image-utils';

describe('detectLanguage', () => {
  test('Chinese characters → zh', () => {
    expect(detectLanguage('椰浆')).toBe('zh');
  });
  test('English letters → en', () => {
    expect(detectLanguage('Salt')).toBe('en');
  });
  test('mixed defaults to zh if first char is CJK', () => {
    expect(detectLanguage('可乐Cola')).toBe('zh');
  });
  test('empty string → en', () => {
    expect(detectLanguage('')).toBe('en');
  });
});

describe('getAdaptiveLabel', () => {
  test('1 Chinese char → full', () => {
    expect(getAdaptiveLabel('盐')).toBe('盐');
  });
  test('3 Chinese chars → full', () => {
    expect(getAdaptiveLabel('老干妈')).toBe('老干妈');
  });
  test('4 Chinese chars → first 2', () => {
    expect(getAdaptiveLabel('厨房纸巾')).toBe('厨房');
  });
  test('6 Chinese chars → first 2', () => {
    expect(getAdaptiveLabel('不锈钢百洁布')).toBe('不锈');
  });
  test('4 English chars → full', () => {
    expect(getAdaptiveLabel('Salt')).toBe('Salt');
  });
  test('5 English chars → first 3', () => {
    expect(getAdaptiveLabel('Towel')).toBe('Tow');
  });
  test('long English → first 3', () => {
    expect(getAdaptiveLabel('Shampoo')).toBe('Sha');
  });
});

describe('getMonogram', () => {
  test('中文取首字', () => {
    expect(getMonogram('老干妈辣酱')).toBe('老');
  });
  test('拉丁取首字母大写', () => {
    expect(getMonogram('shampoo')).toBe('S');
  });
  test('空串返回 ·', () => {
    expect(getMonogram('  ')).toBe('·');
  });
});
