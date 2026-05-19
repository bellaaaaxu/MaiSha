import { useEffect, useState } from 'react';
import { getOrCreateList, joinList } from '@/lib/db';
import type { List } from '@/types/list';

const STORAGE_KEY = 'maisha:list-id';

export function useList(uid: string | null, joinListId: string | null) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const listId = joinListId || localStorage.getItem(STORAGE_KEY);

        if (listId) {
          const joined = await joinList(listId);
          if (cancelled) return;
          if (joined) {
            localStorage.setItem(STORAGE_KEY, joined.id);
            setList(joined);
            setLoading(false);
            return;
          }
          // list_id invalid or deleted — clear stored value
          localStorage.removeItem(STORAGE_KEY);
        }

        const mine = await getOrCreateList(uid);
        if (cancelled) return;
        localStorage.setItem(STORAGE_KEY, mine.id);
        setList(mine);
        setLoading(false);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, joinListId]);

  return { list, setList, loading, error };
}
