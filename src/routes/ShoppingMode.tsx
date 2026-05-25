import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { updateItem } from '@/lib/db';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { ShoppingEndModal } from '@/components/ShoppingEndModal';
import type { Item } from '@/types/item';

export default function ShoppingMode() {
  const { marketId } = useParams<{ marketId: string }>();
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);
  const { iconMap: customIconMap } = useCustomIcons(list?.id ?? null);
  const [showEndModal, setShowEndModal] = useState(false);

  const supermarket = list?.supermarkets.find(s => s.id === marketId);
  const marketItems = useMemo(
    () => items.filter(i => i.supermarket === marketId),
    [items, marketId]
  );

  // Auto-sink: unbought on top, bought on bottom
  const sortedItems = useMemo(() => {
    const unchecked = marketItems.filter(i => !i.checked);
    const checked = marketItems.filter(i => i.checked);
    return [...unchecked, ...checked];
  }, [marketItems]);

  const total = marketItems.length;
  const boughtCount = marketItems.filter(i => i.checked).length;
  const progress = total > 0 ? boughtCount / total : 0;

  if (!supermarket || !list) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>{t('common.loading')}</div>;
  }

  const handleToggle = async (item: Item) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
      await updateItem(item.id, {
        checked: !item.checked,
        checked_at: !item.checked ? new Date().toISOString() : null,
      });
    } catch { /* realtime will revert */ }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 32, background: 'var(--paper)' }}>
      {/* Header: back + store name */}
      <div style={{
        padding: '60px 24px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => nav(-1)}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 15,
            color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          ← {t('shopping.back')}
        </button>
        <div style={{
          fontFamily: 'var(--font-title)', fontSize: 28,
          color: 'var(--ink)', flex: 1,
        }}>
          {supermarket.name}
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: '4px 24px 16px' }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'var(--ink-faint)', marginBottom: 6,
        }}>
          {t('shopping.progress', { bought: boughtCount, total })}
        </div>
        <div style={{
          height: 6, background: 'var(--paper-dark)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, var(--green-soft), var(--green))',
            borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Divider */}
      <div style={{
        margin: '0 24px', height: 2, opacity: 0.5,
        background: 'repeating-linear-gradient(90deg, var(--ink-faint) 0px, var(--ink-faint) 6px, transparent 6px, transparent 10px)',
      }} />

      {/* Items list (image + text) */}
      <div style={{ padding: '0 24px' }}>
        {sortedItems.map(item => {
          const iconUrl = resolveIconUrl(item.name, customIconMap);
          return (
            <div
              key={item.id}
              onClick={() => handleToggle(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 0',
                gap: 14,
                borderBottom: '1px dashed rgba(196, 180, 154, 0.25)',
                cursor: 'pointer',
                opacity: item.checked ? 0.45 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                overflow: 'hidden', flexShrink: 0,
                boxShadow: 'var(--shadow-icon)',
                background: 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {iconUrl
                  ? <img src={iconUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <WatercolorFallback name={item.name} size={46} category="其他" />
                }
              </div>

              {/* Name + note */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 500,
                  color: item.checked ? 'var(--ink-faint)' : 'var(--ink)',
                }}>
                  {item.name}
                </span>
                {(item.note || item.quantity) && (
                  <span style={{ fontSize: 13, color: 'var(--ink-light)' }}>
                    {item.quantity ? `x${item.quantity}` : item.note}
                  </span>
                )}
              </div>

              {/* Bought badge */}
              {item.checked && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--green-soft)', color: 'var(--green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add more button */}
      <div style={{ textAlign: 'center', padding: 16 }}>
        <button style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          color: 'var(--ink-faint)', background: 'none',
          border: '1.5px dashed var(--ink-faint)',
          borderRadius: 'var(--radius-pill)',
          padding: '8px 20px', cursor: 'pointer', opacity: 0.6,
        }}>
          {t('shopping.addMore')}
        </button>
      </div>

      {/* Finish shopping button */}
      <div style={{ padding: '28px 24px', textAlign: 'center' }}>
        <button
          onClick={() => setShowEndModal(true)}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
            color: 'white', background: 'var(--green)',
            border: 'none', borderRadius: 24,
            padding: '14px 48px', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(123, 163, 126, 0.3)',
          }}
        >
          {t('shopping.finish')}
        </button>
      </div>

      {/* End shopping modal */}
      <ShoppingEndModal
        open={showEndModal}
        supermarketName={supermarket.name}
        totalCount={total}
        boughtCount={boughtCount}
        missedCount={total - boughtCount}
        listId={list.id}
        supermarketId={supermarket.id}
        items={marketItems}
        onClose={() => setShowEndModal(false)}
        onDone={() => nav(-1)}
      />
    </div>
  );
}
