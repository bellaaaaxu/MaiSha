export interface ExampleItemSeed {
  name: string;
  note: string;
  quantity: string;
  supermarket: string;
}

// 商品名是种子数据，必须与 icon-registry 的 name/alias 匹配才能命中水彩图标
// （zh-TW 经 normalizeName 繁→简折叠命中；en 无 alias 走装饰兜底，属既定三层降级），
// 因此内嵌三语常量而不走 locale 文件。
// 提示文案受 ItemGrid 备注 chip 宽度约束（92px @ 9px 字号），保持短句。
const SEEDS: Record<string, { items: [string, string, string]; hint: string }> = {
  'zh-CN': { items: ['鸡蛋', '牛奶', '西红柿'], hint: '点圆圈打勾' },
  'zh-TW': { items: ['雞蛋', '牛奶', '番茄'], hint: '點圓圈打勾' },
  en: { items: ['Eggs', 'Milk', 'Tomatoes'], hint: 'Tap circle to check' },
};

// 升级前种下的清单用的是长文案——relocalize 时也要认得它们
const LEGACY_HINTS = [
  '点左边圆圈试试打勾',
  '點左邊圓圈試試打勾',
  'Tap the circle to check it off',
];

export function buildExampleItems(lang: string | null, supermarketId: string): ExampleItemSeed[] {
  const seed = SEEDS[lang ?? ''] ?? SEEDS['zh-CN'];
  return seed.items.map((name, i) => ({
    name,
    note: i === 0 ? seed.hint : '',
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
 * 只精确匹配种子名（任一语言、同一位次）与提示文案（含历史长文案），
 * 用户改过名或自己加的商品绝不触碰。
 */
export function relocalizeExampleItems(
  items: Array<{ id: string; name: string; note?: string | null }>,
  lang: string
): RelocalizePatch[] {
  const target = SEEDS[lang] ?? SEEDS['zh-CN'];
  const locales = Object.values(SEEDS);
  const allHints = [...LEGACY_HINTS, ...locales.map(s => s.hint)];
  const patches: RelocalizePatch[] = [];
  for (const item of items) {
    const pos = locales.reduce<number>(
      (found, s) => (found >= 0 ? found : s.items.indexOf(item.name as (typeof s.items)[number])),
      -1
    );
    const patch: { name?: string; note?: string } = {};
    if (pos >= 0 && item.name !== target.items[pos]) patch.name = target.items[pos];
    if (item.note && allHints.includes(item.note) && item.note !== target.hint) {
      patch.note = target.hint;
    }
    if (Object.keys(patch).length > 0) patches.push({ id: item.id, patch });
  }
  return patches;
}
