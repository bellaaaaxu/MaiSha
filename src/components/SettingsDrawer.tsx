import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from './ConfirmModal';
import { NoticeModal } from './NoticeModal';
import { LanguageSheet } from './LanguageSheet';
import { getCachedAccount } from '@/lib/active-list';

interface Props {
  open: boolean;
  itemCount: number;
  onClose: () => void;
  onClearList: () => Promise<void>;
  onOpenImport: () => void;
  onCopyText: () => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  // 弹层类动作（语言/找回码）不关抽屉——弹层在抽屉上层，关掉后回到抽屉上下文
  keepOpen?: boolean;
}

export function SettingsDrawer({ open, itemCount, onClose, onClearList, onOpenImport, onCopyText }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<{ title?: string; message: string } | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const account = getCachedAccount();

  const copyRecoveryCode = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.recovery_code);
      setNotice({
        message: `${t('settings.recoveryCopied')}\n\n${account.recovery_code}\n\n${t('settings.recoveryHint')}`,
      });
    } catch {
      setNotice({ title: t('settings.recoveryCode'), message: account.recovery_code });
    }
  };

  const items: MenuItem[] = [
    { label: t('settings.language'), action: () => setLangOpen(true), keepOpen: true },
    { label: t('settings.iconLibrary'), action: () => nav('/icons') },
    { label: t('settings.importText'), action: onOpenImport },
    { label: t('settings.exportText'), action: onCopyText },
    { label: t('settings.personalPresets'), action: () => nav('/manage-stores') },
    ...(account ? [{ label: t('settings.recoveryCode'), action: copyRecoveryCode, keepOpen: true }] : []),
    { label: t('settings.joinByCode'), action: () => nav('/join') },
    { label: t('settings.privacy'), action: () => nav('/privacy') },
    { label: t('settings.contact'), action: () => window.open('mailto:support@maisha.app') },
  ];

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearList();
      setConfirmOpen(false);
      onClose();
    } catch {
      setNotice({ message: t('settings.clearFailed') });
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            zIndex: 999, transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 280,
        background: 'var(--paper)',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,0.1)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 1000,
        padding: '60px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflowY: 'auto',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-title)',
          fontSize: 24,
          color: 'var(--ink)',
          marginBottom: 24,
        }}>
          {t('settings.title')}
        </h2>

        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); if (!item.keepOpen) onClose(); }}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              fontWeight: 400,
              color: 'var(--ink)',
              background: 'none',
              border: 'none',
              borderBottom: '1px dashed rgba(196, 180, 154, 0.3)',
              padding: '16px 0',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}

        {/* Clear list — destructive, separated by extra spacing */}
        <button
          onClick={() => itemCount > 0 && setConfirmOpen(true)}
          disabled={itemCount === 0}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 500,
            color: itemCount === 0 ? '#d5cbbe' : '#c97b63',
            background: 'none',
            border: 'none',
            padding: '16px 0',
            marginTop: 24,
            textAlign: 'left',
            cursor: itemCount === 0 ? 'not-allowed' : 'pointer',
            opacity: itemCount === 0 ? 0.6 : 1,
          }}
        >
          {t('settings.clearList')}
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('settings.clearList')}
        message={t('settings.confirmClearList')}
        confirmText={clearing ? '清空中…' : t('settings.clearList')}
        cancelText={t('history.cancel')}
        onConfirm={handleClear}
        onCancel={() => setConfirmOpen(false)}
      />
      <NoticeModal
        open={!!notice}
        title={notice?.title}
        message={notice?.message ?? ''}
        closeText={t('common.ok')}
        onClose={() => setNotice(null)}
      />
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />
    </>
  );
}
