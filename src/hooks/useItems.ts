import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchItems } from '@/lib/db';
import { subscribeItems } from '@/lib/realtime';
import type { Item } from '@/types/item';

export function useItems(listId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optimisticIdsRef = useRef<Set<string>>(new Set());

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
        unsub = subscribeItems(listId, (realtimeItems) => {
          setItems(prev => {
            const realIds = new Set(realtimeItems.map(i => i.id));
            for (const id of realIds) {
              optimisticIdsRef.current.delete(id);
            }
            const stillOptimistic = prev.filter(
              i => optimisticIdsRef.current.has(i.id) && !realIds.has(i.id)
            );
            return [...realtimeItems, ...stillOptimistic];
          });
        }, initial);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();

    return () => { cancelled = true; if (unsub) unsub(); };
  }, [listId]);

  const optimisticAdd = useCallback((item: Item) => {
    optimisticIdsRef.current.add(item.id);
    setItems(prev => [...prev, item]);
  }, []);

  const optimisticRemove = useCallback((itemId: string) => {
    optimisticIdsRef.current.delete(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  return { items, loading, error, optimisticAdd, optimisticRemove };
}
