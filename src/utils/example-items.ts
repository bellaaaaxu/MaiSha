export interface ExampleItemSeed {
  name: string;
  note: string;
  quantity: string;
  supermarket: string;
}

// 商品名是种子数据，必须与 icon-registry 的 name/alias 匹配才能命中水彩图标
// （zh-TW 经 normalizeName 繁→简折叠命中；en 无 alias 走装饰兜底，属既定三层降级），
// 因此内嵌三语常量而不走 locale 文件。
// 示例商品不再带引导备注（2026-07-08 用户决定：示例清单本身即引导，无需教「打勾」）。
const SEEDS: Record<string, { items: [string, string, string] }> = {
  'zh-CN': { items: ['鸡蛋', '牛奶', '西红柿'] },
  'zh-TW': { items: ['雞蛋', '牛奶', '番茄'] },
  en: { items: ['Eggs', 'Milk', 'Tomatoes'] },
};

// 历史版本种下的引导备注——relocalize 时把它们清掉（连同已删的当前文案），
// 让升级前建的清单也去掉备注；商品名照常跟随语言重写。
const LEGACY_HINTS = [
  '点左边圆圈试试打勾',
  '點左邊圓圈試試打勾',
  'Tap the circle to check it off',
  '点圆圈打勾',
  '點圓圈打勾',
  'Tap circle to check',
  '去购物试试打勾',
  '去購物試試打勾',
  'Check off in Shopping',
];

export function buildExampleItems(lang: string | null, supermarketId: string): ExampleItemSeed[] {
  const seed = SEEDS[lang ?? ''] ?? SEEDS['zh-CN'];
  return seed.items.map(name => ({
    name,
    note: '',
    quantity: '',
    supermarket: supermarketId,
  }));
}

export interface RelocalizePatch {
  id: string;
  patch: { name?: string; note?: string };
}

/**
 * 切换界面语言时，把「未被用户改动的示例商品」重写成新语言。
 * 只精确匹配种子名（任一语言、同一位次）；用户改过名或自己加的商品绝不触碰。
 * 引导备注已停用——遇到任一历史备注一律清空（切语言即顺手抹掉旧提示）。
 */
export function relocalizeExampleItems(
  items: Array<{ id: string; name: string; note?: string | null }>,
  lang: string
): RelocalizePatch[] {
  const target = SEEDS[lang] ?? SEEDS['zh-CN'];
  const locales = Object.values(SEEDS);
  const patches: RelocalizePatch[] = [];
  for (const item of items) {
    const pos = locales.reduce<number>(
      (found, s) => (found >= 0 ? found : s.items.indexOf(item.name as (typeof s.items)[number])),
      -1
    );
    const patch: { name?: string; note?: string } = {};
    if (pos >= 0 && item.name !== target.items[pos]) patch.name = target.items[pos];
    if (item.note && LEGACY_HINTS.includes(item.note)) patch.note = '';
    if (Object.keys(patch).length > 0) patches.push({ id: item.id, patch });
  }
  return patches;
}
