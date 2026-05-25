import { useEffect, useCallback, useRef, useState } from 'react';
import { useOffline } from './useOffline';
import { enqueue, getAllQueued, dequeue } from '@/lib/offline-queue';
import { addItem, updateItem } from '@/lib/db';
import type { Item, NewItemInput } from '@/types/item';

export function useOfflineItems(
  listId: string | null,
  uid: string | null,
  setOptimisticItems?: (fn: (prev: Item[]) => Item[]) => void,
) {
  const { isOffline } = useOffline();
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const offlineAdd = useCallback(async (input: NewItemInput): Promise<string> => {
    if (!listId || !uid) throw new Error('No list');

    if (!isOffline) {
      const item = await addItem(listId, uid, input);
      return item.id;
    }

    const localId = `local-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const optimisticItem: Item = {
      id: localId,
      list_id: listId,
      name: input.name ?? '',
      note: input.note ?? '',
      quantity: input.quantity ?? '',
      supermarket: input.supermarket ?? 'none',
      category: input.category ?? '其他',
      category_emoji: input.category_emoji ?? '📦',
      checked: false,
      checked_at: null,
      created_by: uid,
      created_at: now,
      updated_at: now,
    };

    setOptimisticItems?.(prev => [...prev, optimisticItem]);

    await enqueue({
      id: localId,
      type: 'add',
      payload: { listId, uid, input },
      timestamp: Date.now(),
    });
    setPendingCount(c => c + 1);

    return localId;
  }, [listId, uid, isOffline, setOptimisticItems]);

  const offlineCheck = useCallback(async (item: Item): Promise<void> => {
    if (!isOffline) {
      await updateItem(item.id, {
        checked: !item.checked,
        checked_at: !item.checked ? new Date().toISOString() : null,
      });
      return;
    }

    setOptimisticItems?.(prev =>
      prev.map(i => i.id === item.id ? { ...i, checked: !i.checked, checked_at: !i.checked ? new Date().toISOString() : null } : i)
    );

    await enqueue({
      id: `check-${item.id}-${Date.now()}`,
      type: 'check',
      payload: { itemId: item.id, checked: !item.checked },
      timestamp: Date.now(),
    });
    setPendingCount(c => c + 1);
  }, [isOffline, setOptimisticItems]);

  const flush = useCallback(async () => {
    if (flushingRef.current || !listId || !uid) return;
    flushingRef.current = true;

    try {
      const ops = await getAllQueued();
      ops.sort((a, b) => a.timestamp - b.timestamp);

      for (const op of ops) {
        try {
          if (op.type === 'add') {
            const { input } = op.payload as { listId: string; uid: string; input: NewItemInput };
            const real = await addItem(listId, uid, input);
            setOptimisticItems?.(prev =>
              prev.map(i => i.id === op.id ? { ...i, id: real.id } : i)
            );
          } else if (op.type === 'check') {
            const { itemId, checked } = op.payload as { itemId: string; checked: boolean };
            if (!itemId.startsWith('local-')) {
              await updateItem(itemId, {
                checked,
                checked_at: checked ? new Date().toISOString() : null,
              });
            }
          }
          await dequeue(op.id);
        } catch (err) {
          console.warn('[offline-queue] replay failed, removing:', op.id, err);
          await dequeue(op.id);
        }
      }
      setPendingCount(0);
    } finally {
      flushingRef.current = false;
    }
  }, [listId, uid, setOptimisticItems]);

  useEffect(() => {
    if (!isOffline) {
      flush();
    }
  }, [isOffline, flush]);

  useEffect(() => {
    getAllQueued().then(ops => setPendingCount(ops.length)).catch(() => {});
  }, []);

  return { isOffline, pendingCount, offlineAdd, offlineCheck, flush };
}
