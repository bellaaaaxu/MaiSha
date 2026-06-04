import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StorePicker } from '@/components/StorePicker';
import { validateListName } from '@/lib/list-sort';
import { DEFAULT_STORES } from '@/utils/constants';
import type { Store } from '@/types/store';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, stores: Store[]) => Promise<void>;
}

export function NewListSheet({ open, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName(''); setStores([]); setErr(null); setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const validation = validateListName(name);
  const submit = async () => {
    if (!validation.ok) { setErr(validation.error ?? 'invalid'); return; }
    setSubmitting(true);
    try {
      const finalStores = stores.length > 0 ? stores : DEFAULT_STORES;
      await onSubmit(name.trim(), finalStores);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(60,50,40,.28)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        background: '#fbf7f1',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 28px',
        boxShadow: '0 -8px 24px rgba(90,78,60,.18)',
      }}>
        <div style={{ width: 36, height: 4, background: '#cdbfa9', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#5a4e3c', margin: '4px 0 16px' }}>
          {t('newList.title')}
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: '#a0937e', marginBottom: 6 }}>
          {t('newList.nameLabel')}
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('newList.namePlaceholder') ?? ''}
          maxLength={20}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,253,249,.9)',
            border: '1px solid rgba(215,205,188,.5)',
            color: '#5a4e3c',
            fontSize: 16,
            outline: 'none',
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />
        <label style={{ display: 'block', fontSize: 12, color: '#a0937e', marginBottom: 6 }}>
          {t('newList.storesLabel')}
        </label>
        <StorePicker stores={stores} onChange={setStores} />
        {err && (
          <p style={{ color: '#b06a5a', fontSize: 13, marginTop: 12 }}>
            {err === 'empty' ? t('newList.errEmpty')
             : err === 'too-long' ? t('newList.errTooLong')
             : err}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'none', border: '1px solid rgba(215,205,188,.6)', color: '#8a7a64', fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {t('newList.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !validation.ok}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none',
              background: validation.ok ? 'rgba(124,169,130,.22)' : 'rgba(215,205,188,.3)',
              color: validation.ok ? '#5b8a64' : '#a0937e',
              fontSize: 15, fontWeight: 600,
              cursor: submitting || !validation.ok ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? t('newList.creating') : t('newList.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
