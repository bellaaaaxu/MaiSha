import { useEffect, useState } from 'react';
import { fetchItems } from '@/lib/db';
import { subscribeItems } from '@/lib/realtime';
import type { Item } from '@/types/item';

export function useItems(listId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const initial = await fetchItems(listId);
        if (cancelled) return;
        setItems(initial);
        setLoading(false);
        unsub = subscribeItems(listId, setItems, initial);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();

    return () => { cancelled = true; if (unsub) unsub(); };
  }, [listId]);

  return { items, loading, error };
}
