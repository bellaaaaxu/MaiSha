import type { Item } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';
import { groupItemsByMarketAndCategory } from './group-items';

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtItem(it: Item): string {
  let s = it.name;
  if (it.note)     s += ` · ${it.note}`;
  if (it.quantity) s += ` × ${it.quantity}`;
  return s;
}

export function generateShareText(
  items: Item[],
  supermarkets: Supermarket[],
  now: Date = new Date()
): string {
  const unchecked = items.filter(i => !i.checked);
  if (!unchecked.length) {
    return `🛒 买啥 · ${fmtDate(now)}\n\n清单为空 ✨`;
  }

  const groups = groupItemsByMarketAndCategory(unchecked, supermarkets);
  const lines: string[] = [`🛒 买啥 · ${fmtDate(now)} 购物清单`, ''];
  for (const g of groups) {
    lines.push(`${g.supermarket.emoji} ${g.supermarket.name}`);
    for (const c of g.categories) {
      for (const it of c.items) {
        lines.push(`  • ${fmtItem(it)}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
