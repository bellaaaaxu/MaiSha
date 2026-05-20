// src/hooks/useCustomIcons.ts
import { useEffect, useState, useCallback } from 'react';
import { fetchCustomIcons, getPublicIconUrl, type CustomIcon } from '@/lib/custom-icons';

export function useCustomIcons(listId: string | null) {
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    try {
      const fetched = await fetchCustomIcons(listId);
      setIcons(fetched);
      const map = new Map<string, string>();
      for (const icon of fetched) {
        map.set(icon.name, getPublicIconUrl(icon.image_path));
      }
      setIconMap(map);
    } catch (err) {
      console.error('Failed to fetch custom icons:', err);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { iconMap, icons, loading, refresh };
}
