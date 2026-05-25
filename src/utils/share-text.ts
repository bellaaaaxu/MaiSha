import type { Item } from '@/types/item';
import type { Store } from '@/types/store';
import { groupItemsByStore } from './group-items';

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
  supermarkets: Store[],
  now: Date = new Date()
): string {
  const unchecked = items.filter(i => !i.checked);
  if (!unchecked.length) {
    return `🛒 买啥 · ${fmtDate(now)}\n\n清单为空 ✨`;
  }

  const groups = groupItemsByStore(unchecked, supermarkets);
  const lines: string[] = [`🛒 买啥 · ${fmtDate(now)} 购物清单`, ''];
  for (const g of groups) {
    lines.push(`【${g.store.name}】`);
    for (const it of g.items) {
      lines.push(`  • ${fmtItem(it)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
