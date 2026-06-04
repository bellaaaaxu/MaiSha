import { useEffect, useState, useCallback, useRef } from 'react';
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
  const cancelRef = useRef({ cancelled: false });

  /** Internal: do the actual fetch. Guards against stale state via the passed token. */
  const doLoad = useCallback(async (token: { cancelled: boolean }) => {
    if (!accountId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchListsByAccount(accountId);
      if (token.cancelled) return;
      setGroups(sortLists(rows));
      const ids = rows.map(r => r.id);
      if (ids.length === 0) {
        if (!token.cancelled) setSummaries({});
        return;
      }
      const { data: items, error: e } = await supabase
        .from('items')
        .select('list_id, checked')
        .in('list_id', ids);
      if (e) throw e;
      if (token.cancelled) return;
      const summary: ListSummary = {};
      for (const id of ids) summary[id] = { unchecked: 0 };
      for (const it of items ?? []) {
        if (!it.checked) summary[it.list_id].unchecked++;
      }
      setSummaries(summary);
    } catch (err) {
      if (!token.cancelled) setError((err as Error).message);
    } finally {
      if (!token.cancelled) setLoading(false);
    }
  }, [accountId]);

  /** Public refresh: re-runs against the latest accountId, ignoring any in-flight load. */
  const refresh = useCallback(async () => {
    cancelRef.current.cancelled = true;
    const token = { cancelled: false };
    cancelRef.current = token;
    await doLoad(token);
  }, [doLoad]);

  useEffect(() => {
    const token = { cancelled: false };
    cancelRef.current = token;
    doLoad(token);
    return () => { token.cancelled = true; };
  }, [doLoad]);

  return { groups, summaries, loading, error, refresh };
}
