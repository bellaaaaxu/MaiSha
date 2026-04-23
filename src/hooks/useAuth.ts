import { useEffect, useState } from 'react';
import { getOrCreateAnonymousSession } from '@/lib/auth';

export function useAuth() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrCreateAnonymousSession()
      .then(id => { if (!cancelled) { setUid(id); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { uid, loading, error };
}
