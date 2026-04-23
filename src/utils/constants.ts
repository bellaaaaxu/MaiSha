import type { Supermarket } from '@/types/supermarket';
import type { CategoryKey } from '@/types/item';

export const DEFAULT_SUPERMARKETS: Supermarket[] = [
  { id: 'tnt',    name: 'T&T 大统华', emoji: '🥬' },
  { id: 'yc',     name: '元初',       emoji: '🛒' },
  { id: 'costco', name: 'Costco',     emoji: '🏬' },
  { id: 'none',   name: '未分类',     emoji: '❓' }
];

export const UNDELETABLE_SUPERMARKET_ID = 'none';

export interface CategoryDef {
  key: CategoryKey;
  emoji: string;
  keywords: string[];
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { key: '蔬菜',   emoji: '🥬', keywords: ['青菜', '白菜', '西红柿', '黄瓜', '土豆', '胡萝卜', '茄子', '豆角', '菠菜', '生菜', '番茄'] },
  { key: '水果',   emoji: '🍎', keywords: ['苹果', '香蕉', '橙子', '橘子', '葡萄', '草莓', '西瓜', '梨', '桃', '芒果'] },
  { key: '肉蛋',   emoji: '🥩', keywords: ['猪肉', '牛肉', '鸡肉', '羊肉', '鸡蛋', '鸭蛋', '排骨', '肉末'] },
  { key: '乳制品', emoji: '🥛', keywords: ['牛奶', '酸奶', '奶酪', '黄油', '芝士', '奶油'] },
  { key: '主食',   emoji: '🍚', keywords: ['米', '大米', '面条', '饺子', '馒头', '包子', '粉', '面粉'] },
  { key: '烘焙',   emoji: '🍞', keywords: ['面包', '吐司', '蛋糕', '饼干', '曲奇'] },
  { key: '调料',   emoji: '🧂', keywords: ['盐', '糖', '酱油', '醋', '料酒', '生抽', '老抽', '味精', '鸡精', '花椒', '八角'] },
  { key: '零食',   emoji: '🍪', keywords: ['巧克力', '薯片', '糖果', '坚果', '瓜子'] },
  { key: '饮料',   emoji: '🥤', keywords: ['可乐', '雪碧', '茶', '咖啡', '果汁', '矿泉水', '汽水'] },
  { key: '日用',   emoji: '🧻', keywords: ['纸巾', '卷纸', '洗衣液', '洗洁精', '牙膏', '牙刷', '洗发水', '沐浴露', '卫生巾'] }
];

export const FALLBACK_CATEGORY: CategoryKey = '其他';
export const FALLBACK_CATEGORY_EMOJI = '📦';
