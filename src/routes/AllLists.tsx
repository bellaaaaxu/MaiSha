import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useLists } from '@/hooks/useLists';
import { findAccountForUid } from '@/lib/account';
import { persistActiveList } from '@/lib/active-list';
import type { Account } from '@/types/account';
import type { List } from '@/types/list';

export default function AllLists() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const accountId = account?.id ?? null;
  const { groups, summaries, loading } = useLists(accountId);
  const live = [...groups.pinned, ...groups.active];
  const total = live.length + groups.archived.length;

  useEffect(() => {
    if (!uid) return;
    findAccountForUid(uid).then(setAccount);
  }, [uid]);

  const onTap = async (list: List) => {
    if (!account) return;
    await persistActiveList(account, list);
    nav('/list');
  };

  const renderCard = (list: List, archived: boolean, idx: number) => {
    const sum = summaries[list.id];
    const summary = sum && sum.unchecked > 0 ? t('myLists.uncheckedCount', { n: sum.unchecked })
      : archived ? t('allLists.done') : t('myLists.empty');
    return (
      <button
        key={list.id}
        onClick={() => onTap(list)}
        style={{
          width: 'calc(33.33% - 7px)',
          background: archived ? '#f4efe8' : '#fffdf9',
          color: archived ? '#ab9f93' : '#5a4e3c',
          border: '1px solid rgba(215,205,188,.5)',
          borderRadius: 12,
          padding: '8px 9px',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          animation: `mlBounceIn .6s cubic-bezier(.34,1.56,.64,1) backwards`,
          animationDelay: `${idx * 60}ms`,
        }}
      >
        {list.name}
        <small style={{ display: 'block', fontWeight: 400, color: archived ? '#b9ad9f' : '#a0937e', fontSize: 9, marginTop: 4 }}>
          {summary}
        </small>
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 24 }}>
      <style>{`@keyframes mlBounceIn { 0%{transform:translateY(15px) scale(.6);opacity:0;} 70%{transform:translateY(-3px) scale(1.04);opacity:1;} 100%{transform:translateY(0) scale(1);opacity:1;} }`}</style>
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav('/my-lists')} aria-label="back" style={{ background: 'none', border: 'none', fontSize: 22, color: '#8a7a64', cursor: 'pointer', padding: 4 }}>←</button>
        <span style={{ flex: 1, fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)', letterSpacing: 2 }}>{t('allLists.title')}</span>
        <span style={{ color: '#a0937e', fontSize: 13 }}>{total}</span>
      </div>

      {loading ? <p style={{ textAlign: 'center', color: '#a0937e', fontSize: 13, padding: 32 }}>{t('common.loading')}</p> : (
        <>
          {live.length > 0 && (
            <>
              <h3 style={{ fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '14px 16px 8px' }}>{t('allLists.sectionLive')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 14px' }}>
                {live.map((l, i) => renderCard(l, false, i))}
              </div>
            </>
          )}
          {groups.archived.length > 0 && (
            <>
              <h3 style={{ fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '18px 16px 8px' }}>{t('allLists.sectionArchived')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 14px' }}>
                {groups.archived.map((l, i) => renderCard(l, true, live.length + i))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
