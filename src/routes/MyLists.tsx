import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useLists } from '@/hooks/useLists';
import { ListRow } from '@/components/ListRow';
import { ListActionSheet, type ListAction } from '@/components/ListActionSheet';
import { NewListSheet } from '@/components/NewListSheet';
import { canArchive as canArchiveFn, canDelete as canDeleteFn } from '@/lib/list-sort';
import {
  createList, renameList, setListState, deleteList,
} from '@/lib/db';
import { findAccountForUid } from '@/lib/account';
import { persistActiveList, getStoredListId, clearStoredList } from '@/lib/active-list';
import type { List } from '@/types/list';
import type { Account } from '@/types/account';
import type { Store } from '@/types/store';

const ARCHIVE_FOLD_KEY = 'maisha:archive-expanded';

export default function MyLists() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();

  const [account, setAccount] = useState<Account | null>(null);
  const accountId = account?.id ?? null;
  const [currentListId, setCurrentListId] = useState<string | null>(getStoredListId());
  const { groups, summaries, loading, refresh } = useLists(accountId);
  const allLists: List[] = [...groups.pinned, ...groups.active, ...groups.archived];

  const [archiveOpen, setArchiveOpen] = useState<boolean>(
    localStorage.getItem(ARCHIVE_FOLD_KEY) === '1'
  );
  const [actionTarget, setActionTarget] = useState<List | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid) return;
    findAccountForUid(uid).then(a => setAccount(a));
  }, [uid]);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
    };
  }, []);

  const toggleArchiveFold = () => {
    const next = !archiveOpen;
    setArchiveOpen(next);
    localStorage.setItem(ARCHIVE_FOLD_KEY, next ? '1' : '0');
  };

  const onTap = async (list: List) => {
    if (!uid || !account) return;
    await persistActiveList(account, list);
    setCurrentListId(list.id);
    nav('/list');
  };

  const onSwipeAction = async (list: List, action: 'togglePin' | 'archive' | 'delete') => {
    try {
      if (action === 'togglePin') {
        const next = list.state === 'pinned' ? 'active' : 'pinned';
        await setListState(list.id, next, next === 'pinned' ? 0 : null);
      } else if (action === 'archive') {
        await setListState(list.id, 'archived');
      } else if (action === 'delete') {
        if (pendingDelete !== list.id) {
          setPendingDelete(list.id);
          if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
          pendingDeleteTimerRef.current = setTimeout(() => {
            setPendingDelete(null);
            pendingDeleteTimerRef.current = null;
          }, 3000);
          return;
        }
        await deleteList(list.id);
        setPendingDelete(null);
        if (currentListId === list.id) {
          clearStoredList();
        }
      }
      await refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const onActionPick = async (action: ListAction) => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionTarget(null);
    try {
      if (action === 'rename') {
        const next = prompt(t('listActions.renamePrompt') ?? 'Rename to:', target.name);
        if (next && next.trim() && next.trim() !== target.name) {
          await renameList(target.id, next.trim());
        }
      } else if (action === 'togglePin') {
        const next = target.state === 'pinned' ? 'active' : 'pinned';
        await setListState(target.id, next, next === 'pinned' ? 0 : null);
      } else if (action === 'share') {
        const text = target.short_code
          ? `${t('listActions.inviteCode')}：${target.short_code}\n${location.origin}/list?list=${target.id}`
          : `${location.origin}/list?list=${target.id}`;
        try { await navigator.clipboard.writeText(text); alert(t('listActions.shareCopied')); }
        catch { prompt(t('listActions.shareCopy') ?? '复制：', text); }
      } else if (action === 'archive') {
        await setListState(target.id, target.state === 'archived' ? 'active' : 'archived');
      } else if (action === 'delete') {
        if (confirm(t('listActions.confirmDelete', { name: target.name }) ?? `Delete ${target.name}?`)) {
          await deleteList(target.id);
        }
      }
      await refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const onCreate = async (name: string, stores: Store[]) => {
    if (!uid || !accountId || !account) return;
    const created = await createList(accountId, uid, name, stores);
    await persistActiveList(account, created);
    setCurrentListId(created.id);
    setShowNew(false);
    nav('/list');
  };

  const renderRow = (list: List) => {
    const sum = summaries[list.id];
    const summary = sum
      ? sum.unchecked > 0
        ? t('myLists.uncheckedCount', { n: sum.unchecked })
        : t('myLists.empty')
      : undefined;
    return (
      <ListRow
        key={list.id}
        list={list}
        isCurrent={list.id === currentListId}
        summary={summary}
        canArchive={canArchiveFn(list, allLists)}
        canDelete={canDeleteFn(list, allLists)}
        isPendingDelete={pendingDelete === list.id}
        onTap={() => onTap(list)}
        onLongPress={() => setActionTarget(list)}
        onSwipeAction={(a) => onSwipeAction(list, a)}
      />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 24 }}>
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav('/list')} aria-label="back" style={{ background: 'none', border: 'none', fontSize: 22, color: '#8a7a64', cursor: 'pointer', padding: 4 }}>
          ←
        </button>
        <span style={{ flex: 1, fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)', letterSpacing: 2 }}>
          {t('myLists.title')}
        </span>
        <button
          onClick={() => setShowNew(true)}
          aria-label={t('newList.title')}
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(124,169,130,.15)', border: '1px solid rgba(124,169,130,.4)',
            color: '#5b8a64', fontSize: 18, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >＋</button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#a0937e', fontSize: 13, padding: 32 }}>{t('common.loading')}</p>
      ) : (
        <>
          {groups.pinned.length > 0 && (
            <>
              <h3 style={sectionHeaderStyle}>{t('myLists.sectionPinned')}</h3>
              {groups.pinned.map(renderRow)}
            </>
          )}
          {groups.active.length > 0 && (
            <>
              <h3 style={sectionHeaderStyle}>{t('myLists.sectionActive')}</h3>
              {groups.active.map(renderRow)}
            </>
          )}
          {groups.archived.length > 0 && (
            <>
              <button onClick={toggleArchiveFold} style={{ ...sectionHeaderStyle, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('myLists.sectionArchived', { n: groups.archived.length })}
                <span style={{ fontSize: 9 }}>{archiveOpen ? '▾' : '▸'}</span>
              </button>
              {archiveOpen && groups.archived.map(renderRow)}
            </>
          )}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => nav('/all-lists')}
              style={{ background: 'none', border: 'none', color: '#7ca982', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('myLists.seeAll', { n: allLists.length })} →
            </button>
          </div>
        </>
      )}

      <ListActionSheet
        open={!!actionTarget}
        list={actionTarget}
        canArchive={actionTarget ? canArchiveFn(actionTarget, allLists) : true}
        canDelete={actionTarget ? canDeleteFn(actionTarget, allLists) : true}
        onClose={() => setActionTarget(null)}
        onPick={onActionPick}
      />
      <NewListSheet open={showNew} onClose={() => setShowNew(false)} onSubmit={onCreate} />
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '14px 16px 6px', fontWeight: 400, textTransform: 'uppercase',
};
