import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { updateItem } from '@/lib/db';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { ShoppingEndModal } from '@/components/ShoppingEndModal';
import { UNDELETABLE_STORE_ID } from '@/utils/constants';
import type { Item } from '@/types/item';

export default function ShoppingMode() {
  const { marketId } = useParams<{ marketId: string }>();
  const nav = useNavigate();
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
  const uncategorizedItems = useMemo(
    () => marketId !== UNDELETABLE_STORE_ID
      ? items.filter(i => i.supermarket === UNDELETABLE_STORE_ID && !i.checked)
      : [],
    [items, marketId]
  );

  const unchecked = marketItems.filter(i => !i.checked);
  const checked = marketItems.filter(i => i.checked);
  const total = marketItems.length;
  const doneCount = checked.length;
  const progress = total > 0 ? doneCount / total : 0;

  const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);

  if (!supermarket || !list) {
    return <div className="p-8 text-center" style={{ color: '#a0937e' }}>加载中…</div>;
  }

  const onToggle = async (item: Item) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
      await updateItem(item.id, {
        checked: !item.checked,
        checked_at: !item.checked ? new Date().toISOString() : null,
      });
    } catch { /* realtime will revert */ }
  };

  const handleEnd = () => {
    setShowEndModal(true);
  };

  return (
    <div className="min-h-screen pb-8 page-enter" style={{ background: '#faf6f0' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 pt-5 pb-3"
        style={{ background: 'rgba(250,246,240,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
          <span className="text-lg font-bold" style={{ color: '#5a4e3c' }}>{supermarket.name}</span>
          <button onClick={handleEnd} className="text-sm font-medium" style={{ color: '#7ca982' }}>结束</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#ede7dd' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: '#7ca982',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7ca982' }}>{doneCount}/{total}</span>
        </div>
      </div>

      {/* Unchecked items — flat grid */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-3 gap-2.5">
          {unchecked.map(item => (
            <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} />
          ))}
        </div>
      </div>

      {/* Uncategorized "顺便看看" */}
      {uncategorizedItems.length > 0 && (
        <div className="px-3 mt-2 mb-4">
          <button
            onClick={() => setUncategorizedCollapsed(c => !c)}
            className="flex items-center gap-1.5 mb-2 px-1"
          >
            <span className="text-xs" style={{ color: '#bbb' }}>{uncategorizedCollapsed ? '▸' : '▾'}</span>
            <span className="text-xs font-medium" style={{ color: '#bbb' }}>顺便看看 · 未指定店铺</span>
            <span className="text-xs px-1.5 rounded-md" style={{ background: '#f0ebe3', color: '#ccc' }}>
              {uncategorizedItems.length}
            </span>
          </button>
          {!uncategorizedCollapsed && (
            <div className="grid grid-cols-3 gap-2.5">
              {uncategorizedItems.map(item => (
                <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} dimmed />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checked items (sunk to bottom) */}
      {checked.length > 0 && (
        <div className="px-3 mt-2">
          <div className="text-xs font-medium mb-2 px-1" style={{ color: '#bbb' }}>
            ✓ 已买 · {checked.length}件
          </div>
          <div className="grid grid-cols-3 gap-2.5 opacity-40">
            {checked.map(item => (
              <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} checked />
            ))}
          </div>
        </div>
      )}

      {/* End shopping modal */}
      <ShoppingEndModal
        open={showEndModal}
        supermarketName={supermarket.name}
        totalCount={total}
        boughtCount={doneCount}
        missedCount={unchecked.length}
        listId={list.id}
        supermarketId={supermarket.id}
        items={marketItems}
        onClose={() => setShowEndModal(false)}
        onDone={() => nav(-1)}
      />
    </div>
  );
}

/* ---------- ItemCard sub-component ---------- */

function ItemCard({
  item, customIconMap, onToggle, checked, dimmed
}: {
  item: Item;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  checked?: boolean;
  dimmed?: boolean;
}) {
  const iconUrl = resolveIconUrl(item.name, customIconMap);
  const [iconErr, setIconErr] = useState(false);
  const [justChecked, setJustChecked] = useState(false);
  const hasIcon = iconUrl && !iconErr;

  const handleToggle = () => {
    if (!item.checked) setJustChecked(true);
    onToggle(item);
  };

  return (
    <button
      onClick={handleToggle}
      className="relative rounded-2xl p-2 text-center active:scale-95 transition-transform"
      style={{
        background: dimmed ? 'rgba(255,252,247,0.4)' : 'rgba(255,252,247,0.7)',
        border: dimmed ? '1px dashed rgba(215,205,188,0.4)' : '1px solid rgba(215,205,188,0.3)',
        boxShadow: dimmed ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Icon */}
      <div className="w-[72px] h-[72px] mx-auto mb-1.5 rounded-xl overflow-hidden relative">
        {hasIcon ? (
          <img
            src={iconUrl}
            alt=""
            className="w-full h-full object-contain p-1"
            style={{ mixBlendMode: 'multiply' }}
            onError={() => setIconErr(true)}
          />
        ) : (
          <WatercolorFallback name={item.name} category={item.category} size={72} />
        )}
        {(checked || justChecked) && (
          <div
            className={`absolute inset-0 rounded-xl flex items-center justify-center ${justChecked ? 'animate-ink-spread' : ''}`}
            style={{ background: 'rgba(124,169,130,0.35)' }}
            onAnimationEnd={() => setJustChecked(false)}
          >
            <span className="text-2xl text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>✓</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div
        className={`text-xs font-medium truncate ${checked ? 'line-through' : ''}`}
        style={{ color: checked ? '#bbb' : dimmed ? '#999' : '#5a4e3c' }}
      >
        {item.name}
      </div>

      {/* Note */}
      {item.note && !checked && (
        <div className="text-[10px] truncate mt-0.5" style={{ color: '#bbb' }}>{item.note}</div>
      )}

      {/* Quantity badge */}
      {item.quantity && !checked && (
        <div
          className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg text-white"
          style={{ background: '#c97b63' }}
        >
          ×{item.quantity}
        </div>
      )}
    </button>
  );
}
