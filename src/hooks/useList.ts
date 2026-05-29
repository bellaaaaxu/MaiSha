import { useEffect, useState } from 'react';
import { resolveActiveContext } from '@/lib/bootstrap';
import { getDurableStore } from '@/lib/durable-store';
import { findAccountForUid, createAccount, claimAccount } from '@/lib/account';
import { joinList, getOrCreatePrimaryList } from '@/lib/db';
import { getStoredListId, persistActiveList } from '@/lib/active-list';
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
        const { account, list } = await resolveActiveContext(
          {
            loadDurable: () => getDurableStore().load(),
            findAccountForUid,
            claimAccount,
            createAccount,
            getStoredListId,
            joinOrGetList: joinList,
            getOrCreatePrimaryList,
          },
          { uid, urlListId: joinListId }
        );
        if (cancelled) return;
        await persistActiveList(account, list);
        if (cancelled) return;
        setList(list);
        setLoading(false);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, joinListId]);

  return { list, setList, loading, error };
}
