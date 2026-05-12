export interface IconItem {
  name: string;
  icon: string;
  category: string;
  aliases?: string[];
}

export const ICON_ITEMS: IconItem[] = [
  // 蔬菜
  { name: '娃娃菜', icon: 'baby-cabbage', category: '蔬菜' },
  { name: '西红柿', icon: 'tomato', category: '蔬菜', aliases: ['番茄'] },
  { name: '洋葱', icon: 'onion', category: '蔬菜' },
  { name: '大蒜', icon: 'garlic', category: '蔬菜' },
  { name: '生姜', icon: 'ginger', category: '蔬菜' },
  { name: '韭菜', icon: 'chives', category: '蔬菜' },
  { name: '小葱', icon: 'scallion', category: '蔬菜', aliases: ['香葱'] },
  { name: '白萝卜', icon: 'daikon', category: '蔬菜' },
  { name: '茭白', icon: 'water-bamboo', category: '蔬菜' },
  // 肉类
  { name: '五花肉', icon: 'pork-belly', category: '肉蛋' },
  { name: '猪排骨', icon: 'pork-ribs', category: '肉蛋', aliases: ['排骨'] },
  { name: '牛肋条', icon: 'beef-short-rib-strips', category: '肉蛋' },
  { name: '牛仔骨', icon: 'beef-short-ribs', category: '肉蛋' },
  { name: '整鸡', icon: 'whole-chicken', category: '肉蛋' },
  // 蛋奶
  { name: '鸡蛋', icon: 'eggs', category: '肉蛋' },
  { name: '牛奶', icon: 'milk', category: '乳制品' },
  { name: '豆浆', icon: 'soy-milk', category: '饮料' },
  // 主食
  { name: '大米', icon: 'rice', category: '主食', aliases: ['米'] },
  { name: '速冻饺子', icon: 'frozen-dumplings', category: '主食', aliases: ['饺子'] },
  // 调料
  { name: '咖喱块', icon: 'curry-block', category: '调料' },
  { name: '食用油', icon: 'cooking-oil', category: '调料' },
  { name: '生抽', icon: 'light-soy-sauce', category: '调料' },
  { name: '老抽', icon: 'dark-soy-sauce', category: '调料' },
  { name: '老陈醋', icon: 'aged-vinegar', category: '调料' },
  { name: '香醋', icon: 'chinkiang-vinegar', category: '调料' },
  { name: '白醋', icon: 'white-vinegar', category: '调料' },
  { name: '料酒', icon: 'cooking-wine', category: '调料' },
  { name: '盐', icon: 'salt', category: '调料' },
  { name: '糖', icon: 'sugar', category: '调料' },
  { name: '蚝油', icon: 'oyster-sauce', category: '调料' },
  { name: '豆瓣酱', icon: 'doubanjiang', category: '调料' },
  { name: '番茄酱', icon: 'ketchup', category: '调料' },
  { name: '十三香', icon: 'thirteen-spice', category: '调料', aliases: ['五香粉'] },
  { name: '桂皮', icon: 'cinnamon-bark', category: '调料' },
  { name: '八角', icon: 'star-anise', category: '调料' },
  { name: '香叶', icon: 'bay-leaves', category: '调料' },
  { name: '花椒', icon: 'sichuan-pepper', category: '调料' },
  // 日用
  { name: '纸巾', icon: 'tissue-box', category: '日用', aliases: ['抽纸'] },
  { name: '卫生纸', icon: 'toilet-paper', category: '日用', aliases: ['卷纸'] },
  { name: '厨房纸巾', icon: 'kitchen-towel', category: '日用' },
  { name: '垃圾袋', icon: 'trash-bags', category: '日用' },
  { name: '洗衣液', icon: 'laundry-detergent', category: '日用' },
  { name: '洗洁精', icon: 'dish-soap', category: '日用' },
  { name: '保鲜膜', icon: 'cling-wrap', category: '日用' },
  { name: '洗手液', icon: 'hand-soap', category: '日用' },
  { name: '沐浴露', icon: 'body-wash', category: '日用' },
  { name: '洗发水', icon: 'shampoo', category: '日用' },
  { name: '牙膏', icon: 'toothpaste', category: '日用' },
  { name: '牙刷', icon: 'toothbrush', category: '日用' },
  // 烘焙
  { name: '低筋面粉', icon: 'cake-flour', category: '烘焙' },
  { name: '高筋面粉', icon: 'bread-flour', category: '烘焙' },
  { name: '炼乳', icon: 'condensed-milk', category: '烘焙' },
  { name: '小苏打', icon: 'baking-soda', category: '烘焙' },
  // 饮料
  { name: '可乐', icon: 'cola', category: '饮料' },
  { name: '冰红茶', icon: 'iced-tea', category: '饮料' },
  { name: '桃汁', icon: 'peach-juice', category: '饮料' },
  { name: '旺仔牛奶', icon: 'flavored-milk', category: '饮料' },
  { name: '矿泉水', icon: 'water', category: '饮料' },
];

export const UNIQUE_ICON_ITEMS = ICON_ITEMS;

export function getIconPath(name: string): string | null {
  const exact = ICON_ITEMS.find(i => i.name === name || i.aliases?.includes(name));
  if (exact) return `/icons/${exact.icon}.png`;
  const partial = ICON_ITEMS.find(i => name.includes(i.name) || i.name.includes(name));
  if (partial) return `/icons/${partial.icon}.png`;
  return null;
}

export function iconExists(icon: string): boolean {
  try {
    const img = new Image();
    img.src = `/icons/${icon}.png`;
    return true;
  } catch {
    return false;
  }
}
