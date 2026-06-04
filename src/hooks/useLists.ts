import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchListsByAccount } from '@/lib/db';
import { sortLists, type SortedLists } from '@/lib/list-sort';

/** 每清单的「待买件数」摘要。 */
export type ListSummary = Record<string, { unchecked: number }>;

interface UseListsReturn {
  groups: SortedLists;
  summaries: ListSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** 拉取账号下所有清单（含 archived）+ 批量预取「未勾选件数」。 */
export function useLists(accountId: string | null): UseListsReturn {
  const [groups, setGroups] = useState<SortedLists>({ pinned: [], active: [], archived: [] });
  const [summaries, setSummaries] = useState<ListSummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const rows = await fetchListsByAccount(accountId);
      setGroups(sortLists(rows));
      // batch items count: SELECT list_id, count(*) WHERE list_id IN (...) AND checked = false
      const ids = rows.map(r => r.id);
      if (ids.length === 0) { setSummaries({}); return; }
      const { data: items, error: e } = await supabase
        .from('items')
        .select('list_id, checked')
        .in('list_id', ids);
      if (e) throw e;
      const summary: ListSummary = {};
      for (const id of ids) summary[id] = { unchecked: 0 };
      for (const it of items ?? []) {
        if (!it.checked) summary[it.list_id].unchecked++;
      }
      setSummaries(summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  return { groups, summaries, loading, error, refresh: load };
}
