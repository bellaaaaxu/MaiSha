import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();

  const items = [
    { label: t('settings.language'), action: () => nav('/settings/language') },
    { label: t('settings.iconLibrary'), action: () => nav('/icons') },
    { label: t('settings.importExport'), action: () => nav('/settings/import-export') },
    { label: t('settings.personalPresets'), action: () => nav('/manage-stores') },
    { label: t('settings.privacy'), action: () => nav('/privacy') },
    { label: t('settings.contact'), action: () => window.open('mailto:support@maisha.app') },
  ];

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
            onClick={() => { item.action(); onClose(); }}
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
      </div>
    </>
  );
}
