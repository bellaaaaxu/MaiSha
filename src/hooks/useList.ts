import { useEffect, useState } from 'react';
import { getOrCreateList, joinList } from '@/lib/db';
import type { List } from '@/types/list';

export function useList(uid: string | null, joinListId: string | null) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        if (joinListId) {
          const joined = await joinList(joinListId);
          if (!cancelled) { setList(joined); setLoading(false); return; }
        }
        const mine = await getOrCreateList(uid);
        if (!cancelled) { setList(mine); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, joinListId]);

  return { list, setList, loading, error };
}
