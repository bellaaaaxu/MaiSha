import { useTranslation } from 'react-i18next';
import type { List } from '@/types/list';

export type ListAction = 'rename' | 'togglePin' | 'share' | 'archive' | 'delete';

interface Props {
  open: boolean;
  list: List | null;
  canDelete: boolean;       // false = greyed (last active)
  canArchive: boolean;      // false = greyed
  onClose: () => void;
  onPick: (action: ListAction) => void;
}

export function ListActionSheet({ open, list, canDelete, canArchive, onClose, onPick }: Props) {
  const { t } = useTranslation();
  if (!open || !list) return null;

  const items: Array<{ key: ListAction; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: 'rename', label: t('listActions.rename') },
    { key: 'togglePin', label: list.state === 'pinned' ? t('listActions.unpin') : t('listActions.pin') },
    { key: 'share', label: t('listActions.share') },
    { key: 'archive', label: list.state === 'archived' ? t('listActions.unarchive') : t('listActions.archive'), disabled: !canArchive && list.state !== 'archived' },
    { key: 'delete', label: t('listActions.delete'), danger: true, disabled: !canDelete },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(60,50,40,.28)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        background: '#fbf7f1',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 24px',
        boxShadow: '0 -8px 24px rgba(90,78,60,.18)',
      }}>
        <div style={{ width: 36, height: 4, background: '#cdbfa9', borderRadius: 2, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13, color: '#a0937e', textAlign: 'center', marginBottom: 6 }}>{list.name}</div>
        {items.map((it, i) => (
          <button
            key={it.key}
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) onPick(it.key); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 4px',
              background: 'none',
              border: 'none',
              borderTop: i > 0 ? '1px solid rgba(215,205,188,.4)' : 'none',
              textAlign: 'left',
              fontSize: 15,
              fontWeight: 500,
              color: it.disabled ? '#bcae98' : it.danger ? '#b06a5a' : '#5a4e3c',
              cursor: it.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
