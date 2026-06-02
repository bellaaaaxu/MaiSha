// tests/watercolor-fallback.test.ts
import { describe, test, expect } from 'vitest';
import { getCategoryColor, CATEGORY_WATERCOLORS } from '@/components/WatercolorFallback';

describe('getCategoryColor', () => {
  test('蔬菜 returns green palette', () => {
    const color = getCategoryColor('蔬菜');
    expect(color.gradient).toContain('#a8d5a2');
  });

  test('肉蛋 returns warm palette', () => {
    const color = getCategoryColor('肉蛋');
    expect(color.gradient).toContain('#f0c9a0');
  });

  test('unknown category returns gray palette', () => {
    const color = getCategoryColor('未知类别');
    expect(color.gradient).toContain('#d5d0c8');
  });

  test('all categories have colors defined', () => {
    const categories = ['蔬菜', '水果', '肉蛋', '乳制品', '主食', '烘焙', '调料', '零食', '饮料', '日用', '海鲜', '豆制品', '干货', '速冻', '方便食品', '酒水', '个护', '其他'];
    for (const cat of categories) {
      expect(CATEGORY_WATERCOLORS[cat]).toBeDefined();
    }
  });
});
