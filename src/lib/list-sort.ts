import type { List } from '@/types/list';

export interface SortedLists {
  pinned: List[];
  active: List[];
  archived: List[];
}

/** 排序：pinned 按 pin_order ASC NULLS LAST 再 updated_at DESC；active/archived 按 updated_at DESC。 */
export function sortLists(rows: List[]): SortedLists {
  const cmpUpdatedDesc = (a: List, b: List) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  const pinned = rows
    .filter(r => r.state === 'pinned')
    .sort((a, b) => {
      const ao = a.pin_order, bo = b.pin_order;
      if (ao === null && bo === null) return cmpUpdatedDesc(a, b);
      if (ao === null) return 1;
      if (bo === null) return -1;
      if (ao !== bo) return ao - bo;
      return cmpUpdatedDesc(a, b);
    });
  const active = rows.filter(r => r.state === 'active').sort(cmpUpdatedDesc);
  const archived = rows.filter(r => r.state === 'archived').sort(cmpUpdatedDesc);
  return { pinned, active, archived };
}

/** 是否允许归档：若它是仅剩的 active+pinned，则不行。 */
export function canArchive(list: List, all: List[]): boolean {
  if (list.state === 'archived') return true;
  const othersAlive = all.some(
    r => r.id !== list.id && (r.state === 'active' || r.state === 'pinned')
  );
  return othersAlive;
}

/** 校验清单名：trim 后非空 ≤ 20 字符。 */
export function validateListName(input: string): { ok: boolean; error?: string } {
  const v = input.trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > 20) return { ok: false, error: 'too-long' };
  return { ok: true };
}
