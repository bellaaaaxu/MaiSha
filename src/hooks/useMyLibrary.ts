import { useEffect, useState, useCallback } from 'react';
import { fetchMyLibrary, type CustomIcon } from '@/lib/custom-icons';

export function useMyLibrary(accountId: string | null) {
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    try {
      setIcons(await fetchMyLibrary(accountId));
    } catch (err) {
      console.error('Failed to fetch my icon library:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { icons, loading, refresh };
}
