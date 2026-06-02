export interface IconItem {
  name: string;
  icon: string;              // filename stem for /icons/{icon}.webp
  iconUrl?: string;          // full URL (custom icons); takes precedence when present
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
  // 肉类
  { name: '五花肉', icon: 'pork-belly', category: '肉蛋' },
  { name: '猪排骨', icon: 'pork-ribs', category: '肉蛋', aliases: ['排骨'] },
  { name: '牛肋条', icon: 'beef-short-rib-strips', category: '肉蛋' },
  { name: '牛仔骨', icon: 'beef-short-ribs', category: '肉蛋' },
  { name: '整鸡', icon: 'whole-chicken', category: '肉蛋' },
  // 蛋奶
  { name: '鸡蛋', icon: 'eggs', category: '肉蛋' },
  { name: '牛奶', icon: 'milk', category: '乳制品' },
  // 主食
  { name: '大米', icon: 'rice', category: '主食', aliases: ['米'] },
  { name: '速冻饺子', icon: 'frozen-dumplings', category: '主食', aliases: ['饺子'] },
  // 调料
  { name: '食用油', icon: 'cooking-oil', category: '调料' },
  { name: '盐', icon: 'salt', category: '调料' },
  { name: '桂皮', icon: 'cinnamon-bark', category: '调料' },
  { name: '八角', icon: 'star-anise', category: '调料' },
  { name: '香叶', icon: 'bay-leaves', category: '调料' },
  { name: '花椒', icon: 'sichuan-pepper', category: '调料' },
  // 日用
  { name: '纸巾', icon: 'tissue-box', category: '日用', aliases: ['抽纸'] },
  { name: '卫生纸', icon: 'toilet-paper', category: '日用', aliases: ['卷纸'] },
  { name: '厨房纸巾', icon: 'kitchen-towel', category: '日用' },
  { name: '垃圾袋', icon: 'trash-bags', category: '日用' },
  { name: '保鲜膜', icon: 'cling-wrap', category: '日用' },
  { name: '洗手液', icon: 'hand-soap', category: '日用' },
  { name: '沐浴露', icon: 'body-wash', category: '日用' },
  { name: '洗发水', icon: 'shampoo', category: '日用' },
  { name: '护发素', icon: 'conditioner', category: '日用' },
  { name: '牙膏', icon: 'toothpaste', category: '日用' },
  { name: '牙刷', icon: 'toothbrush', category: '日用' },
  // 烘焙
  { name: '低筋面粉', icon: 'cake-flour', category: '烘焙' },
  { name: '高筋面粉', icon: 'bread-flour', category: '烘焙' },
  { name: '炼乳', icon: 'condensed-milk', category: '烘焙' },
  // 饮料
  { name: '矿泉水', icon: 'water', category: '饮料' },
  // 水果
  { name: '苹果', icon: 'apple', category: '水果' },
  { name: '香蕉', icon: 'banana', category: '水果' },
  { name: '橙子', icon: 'orange', category: '水果' },
  { name: '葡萄', icon: 'grapes', category: '水果' },
  { name: '草莓', icon: 'strawberry', category: '水果' },
  { name: '西瓜', icon: 'watermelon', category: '水果' },
  { name: '梨', icon: 'pear', category: '水果' },
  { name: '柠檬', icon: 'lemon', category: '水果' },
  { name: '牛油果', icon: 'avocado', category: '水果' },
  { name: '蓝莓', icon: 'blueberry', category: '水果' },
  { name: '虾', icon: 'shrimp', category: '海鲜' },
  { name: '鱼', icon: 'fish', category: '海鲜' },
  { name: '三文鱼', icon: 'salmon', category: '海鲜' },
  { name: '蛤蜊', icon: 'clams', category: '海鲜' },
  { name: '螃蟹', icon: 'crab', category: '海鲜' },
  { name: '土豆', icon: 'potato', category: '蔬菜' },
  { name: '青椒', icon: 'green-pepper', category: '蔬菜' },
  { name: '黄瓜', icon: 'cucumber', category: '蔬菜' },
  { name: '菠菜', icon: 'spinach', category: '蔬菜' },
  { name: '胡萝卜', icon: 'carrot', category: '蔬菜' },
  { name: '玉米', icon: 'corn', category: '蔬菜' },
  { name: '蘑菇', icon: 'mushroom', category: '蔬菜' },
  { name: '西兰花', icon: 'broccoli', category: '蔬菜' },
  { name: '芹菜', icon: 'celery', category: '蔬菜' },
  { name: '生菜', icon: 'lettuce', category: '蔬菜' },
  { name: '豆腐', icon: 'tofu', category: '豆制品' },
  { name: '面条', icon: 'noodles', category: '主食' },
  { name: '面包', icon: 'bread', category: '主食' },
  { name: '意面', icon: 'pasta', category: '主食' },
  { name: '酸奶', icon: 'yogurt', category: '乳制品' },
  { name: '奶酪', icon: 'cheese', category: '乳制品' },
  { name: '可乐', icon: 'cola', category: '饮料' },
  { name: '冰红茶', icon: 'iced-tea', category: '饮料' },
  { name: '桃汁', icon: 'peach-juice', category: '饮料' },
  { name: '豆浆', icon: 'soy-milk', category: '饮料' },
  { name: '咖喱块', icon: 'curry-block', category: '调料' },
  { name: '生抽', icon: 'light-soy-sauce', category: '调料' },
  { name: '老抽', icon: 'dark-soy-sauce', category: '调料' },
  { name: '料酒', icon: 'cooking-wine', category: '调料' },
  { name: '糖', icon: 'sugar', category: '调料' },
  { name: '蚝油', icon: 'oyster-sauce', category: '调料' },
  { name: '豆瓣酱', icon: 'doubanjiang', category: '调料' },
  { name: '番茄酱', icon: 'ketchup', category: '调料' },
  { name: '洗衣球', icon: 'laundry-pods', category: '日用' },
  { name: '洗洁精', icon: 'dish-soap', category: '日用' },
  { name: '小苏打', icon: 'baking-soda', category: '烘焙' },
  { name: '五香粉', icon: 'five-spice', category: '调料' },
];

export const UNIQUE_ICON_ITEMS = ICON_ITEMS;

export function getIconPath(name: string): string | null {
  const exact = ICON_ITEMS.find(i => i.name === name || i.aliases?.includes(name));
  if (exact) return `/icons/${exact.icon}.webp`;
  const partial = ICON_ITEMS.find(i => name.includes(i.name) || i.name.includes(name));
  if (partial) return `/icons/${partial.icon}.webp`;
  return null;
}

/**
 * Resolve icon URL with custom icon support.
 * Priority: custom icon → preset icon → null (caller renders WatercolorFallback)
 */
export function resolveIconUrl(
  name: string,
  customIconMap?: Map<string, string>
): string | null {
  // 1. Custom icon (user's explicit choice for this list, may override preset)
  if (customIconMap) {
    const custom = customIconMap.get(name);
    if (custom) return custom;
  }
  // 2. Preset icon
  const preset = getIconPath(name);
  if (preset) return preset;
  // 3. No match — caller should render WatercolorFallback
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
