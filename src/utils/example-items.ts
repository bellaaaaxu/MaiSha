export interface ExampleItemSeed {
  name: string;
  note: string;
  quantity: string;
  supermarket: string;
}

// 商品名是种子数据，必须与 icon-registry 的 name/alias 匹配才能命中水彩图标
// （zh-TW 经 normalizeName 繁→简折叠命中；en 无 alias 走水彩兜底，属既定三层降级），
// 因此内嵌三语常量而不走 locale 文件。
const SEEDS: Record<string, { items: [string, string, string]; hint: string }> = {
  'zh-CN': { items: ['鸡蛋', '牛奶', '西红柿'], hint: '点左边圆圈试试打勾' },
  'zh-TW': { items: ['雞蛋', '牛奶', '番茄'], hint: '點左邊圓圈試試打勾' },
  en: { items: ['Eggs', 'Milk', 'Tomatoes'], hint: 'Tap the circle to check it off' },
};

export function buildExampleItems(lang: string | null, supermarketId: string): ExampleItemSeed[] {
  const seed = SEEDS[lang ?? ''] ?? SEEDS['zh-CN'];
  return seed.items.map((name, i) => ({
    name,
    note: i === 0 ? seed.hint : '',
    quantity: '',
    supermarket: supermarketId,
  }));
}
