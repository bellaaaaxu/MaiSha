import { useEffect, useState, useCallback } from 'react';
import { fetchListIconMap, type CustomIcon } from '@/lib/custom-icons';

export function useCustomIcons(listId: string | null) {
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());
  const [icons] = useState<CustomIcon[]>([]); // union has no single-list "icons"; kept for shape compat
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    try {
      setIconMap(await fetchListIconMap(listId));
    } catch (err) {
      console.error('Failed to fetch icon map:', err);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { iconMap, icons, loading, refresh };
}
