import { useState, useEffect, useCallback } from 'react';
import { fetchPurchaseHistory } from '@/lib/purchase-history';
import type { PurchaseHistory } from '@/types/purchase-history';

export function usePurchaseHistory(listId: string | null) {
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const data = await fetchPurchaseHistory(listId);
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { history, loading, refresh };
}
