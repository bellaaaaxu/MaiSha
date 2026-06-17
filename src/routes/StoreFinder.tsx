import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { findStoresFor, commitStoreChoice } from '@/lib/store-finder';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { resolveIconUrl } from '@/utils/icon-registry';
import type { RankedStore } from '@/types/store-finder';

type Phase = 'input' | 'loading' | 'results' | 'empty' | 'denied' | 'offline';

export default function StoreFinder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid } = useAuth();
  // StoreFinder is accessed after list is already set up; no joinListId needed
  const { list } = useList(uid, null);
  const [product, setProduct] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [stores, setStores] = useState<RankedStore[]>([]);

  async function run(name: string) {
    if (!name.trim()) return;
    setProduct(name.trim());
    setPhase('loading');
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') {
        setPhase('denied');
        return;
      }
      const pos = await Geolocation.getCurrentPosition();
      const found = await findStoresFor(name.trim(), {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setStores(found);
      setPhase(found.length ? 'results' : 'empty');
    } catch {
      setPhase(navigator.onLine ? 'denied' : 'offline');
    }
  }

  async function pick(s: RankedStore) {
    if (!list || !uid) return;
    await commitStoreChoice(list, uid, product, {
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
    });
    navigate('/list');
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--paper)',
    padding: '16px 16px 32px',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    color: '#5a4e3c',
    fontFamily: 'var(--font-title)',
    marginBottom: 16,
  };

  return (
    <div style={pageStyle}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--ink-light)',
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 12,
        }}
      >
        ← {t('common.back')}
      </button>

      <h2 style={headingStyle}>{t('storeFinder.title')}</h2>

      {/* Input phase */}
      {phase === 'input' && (
        <div>
          <input
            autoFocus
            placeholder={t('storeFinder.searchPlaceholder')}
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(product);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1.5px solid rgba(215,205,188,0.6)',
              background: 'rgba(255,252,247,0.8)',
              fontSize: 16,
              color: '#5a4e3c',
              fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <button
            onClick={() => run(product)}
            disabled={!product.trim()}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '13px 16px',
              borderRadius: 'var(--radius-card)',
              background: product.trim() ? 'var(--accent)' : 'rgba(215,205,188,0.4)',
              color: product.trim() ? '#fff' : 'var(--ink-light)',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: product.trim() ? 'pointer' : 'default',
              transition: 'background 200ms ease',
            }}
          >
            🔍 {t('storeFinder.title')}
          </button>
        </div>
      )}

      {/* Loading phase */}
      {phase === 'loading' && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: 'var(--ink-light)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
          <p style={{ fontSize: 15 }}>{t('storeFinder.searching')}</p>
        </div>
      )}

      {/* Denied phase */}
      {phase === 'denied' && (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
          <p style={{ fontSize: 15, color: '#5a4e3c', marginBottom: 20 }}>
            {t('storeFinder.locationDenied')}
          </p>
          <button
            onClick={() => setPhase('input')}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-card)',
              background: 'none',
              border: '1.5px solid rgba(215,205,188,0.6)',
              color: 'var(--ink-light)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {/* Offline phase */}
      {phase === 'offline' && (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📶</div>
          <p style={{ fontSize: 15, color: '#5a4e3c', marginBottom: 20 }}>
            {t('storeFinder.offline')}
          </p>
          <button
            onClick={() => setPhase('input')}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-card)',
              background: 'none',
              border: '1.5px solid rgba(215,205,188,0.6)',
              color: 'var(--ink-light)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {/* Empty phase */}
      {phase === 'empty' && (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏪</div>
          <p style={{ fontSize: 15, color: '#5a4e3c', marginBottom: 20 }}>
            {t('storeFinder.noResults', { item: product })}
          </p>
          <button
            onClick={() => { navigate('/manage-stores'); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 16px',
              borderRadius: 'var(--radius-card)',
              background: 'none',
              border: '1.5px dashed rgba(215,205,188,0.6)',
              color: 'var(--ink-light)',
              fontSize: 15,
              cursor: 'pointer',
              marginBottom: 12,
            }}
          >
            {t('storeFinder.addManually')}
          </button>
          <button
            onClick={() => setPhase('input')}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-card)',
              background: 'none',
              border: '1.5px solid rgba(215,205,188,0.6)',
              color: 'var(--ink-light)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {/* Results phase */}
      {phase === 'results' && (
        <div>
          {/* Product header with icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              padding: '10px 14px',
              background: 'rgba(255,252,247,0.7)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid rgba(215,205,188,0.4)',
            }}
          >
            {resolveIconUrl(product) ? (
              <img
                src={resolveIconUrl(product)!}
                width={36}
                height={36}
                alt=""
                style={{ borderRadius: 8, objectFit: 'cover' }}
              />
            ) : (
              <WatercolorFallback name={product} category="其他" size={36} />
            )}
            <strong style={{ fontSize: 15, color: '#5a4e3c' }}>{product}</strong>
          </div>

          {/* Store cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stores.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                onClick={() => pick(s)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  background: 'rgba(255,252,247,0.8)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid rgba(215,205,188,0.35)',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 15, color: '#5a4e3c' }}>
                  🏪 {s.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-light)' }}>
                  {s.matchedTerm}
                  {' · '}
                  {t('storeFinder.distanceKm', { km: (s.distanceMeters / 1000).toFixed(1) })}
                </div>
                {s.address && (
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--ink-light)' }}>
                    {s.address}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Back to input */}
          <button
            onClick={() => setPhase('input')}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 'var(--radius-card)',
              background: 'none',
              border: '1.5px dashed rgba(215,205,188,0.5)',
              color: 'var(--ink-light)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('common.back')}
          </button>
        </div>
      )}
    </div>
  );
}
