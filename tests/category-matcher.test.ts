import { describe, test, expect } from 'vitest';
import { matchCategory } from '@/utils/category-matcher';

describe('matchCategory', () => {
  test('牛奶 → 乳制品 🥛', () => {
    const r = matchCategory('牛奶');
    expect(r.category).toBe('乳制品');
    expect(r.emoji).toBe('🥛');
  });

  test('青菜 → 蔬菜 🥬', () => {
    expect(matchCategory('青菜').category).toBe('蔬菜');
    expect(matchCategory('青菜').emoji).toBe('🥬');
  });

  test('部分匹配：伊利纯牛奶 1L → 乳制品', () => {
    expect(matchCategory('伊利纯牛奶 1L').category).toBe('乳制品');
  });

  test('未匹配 → 其他 📦', () => {
    const r = matchCategory('神秘物品xyz');
    expect(r.category).toBe('其他');
    expect(r.emoji).toBe('📦');
  });

  test('空字符串 → 其他', () => {
    expect(matchCategory('').category).toBe('其他');
  });

  test('命中多个类别时按 CATEGORY_DEFS 顺序取先', () => {
    // "牛肉饺子" 同时含 "牛肉"（肉蛋）和 "饺子"（主食）；肉蛋先定义
    expect(matchCategory('牛肉饺子').category).toBe('肉蛋');
  });
});
