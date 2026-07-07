import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { resolveIconUrl } from '@/utils/icon-registry';
import { DecorFallback } from '@/components/DecorFallback';
import type { Item } from '@/types/item';

interface Props {
  item: Item;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}

export function ItemRow({ item, customIconMap, onToggle, onMenu }: Props) {
  const checked = item.checked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item }
  });
  const iconUrl = resolveIconUrl(item.name, customIconMap);
  const [iconErr, setIconErr] = useState(false);
  const hasIcon = iconUrl && !iconErr;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'manipulation' }}
      onClick={() => onToggle(item)}
      className={`flex items-center gap-3 rounded-2xl p-2.5 mb-2 transition-all cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-30' : ''
      }`}
      role="button"
    >
      {/* icon or watercolor fallback */}
      <div
        className={`shrink-0 flex items-center justify-center rounded-xl ${
          checked ? 'opacity-40 grayscale' : ''
        }`}
        style={{
          width: hasIcon ? 56 : 48,
          height: hasIcon ? 56 : 48,
          background: hasIcon ? 'rgba(255,252,247,0.5)' : 'transparent',
          border: hasIcon ? '1px solid rgba(215,205,188,0.3)' : 'none',
        }}
      >
        {hasIcon ? (
          <img
            src={iconUrl}
            alt=""
            className="w-full h-full object-contain rounded-xl p-1"
            style={{ mixBlendMode: 'multiply' }}
            onError={() => setIconErr(true)}
          />
        ) : (
          <DecorFallback name={item.name} category={item.category} size={48} />
        )}
      </div>

      {/* text */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${checked ? 'line-through' : ''}`}
          style={{ color: checked ? '#b8a992' : '#5a4e3c' }}
        >
          {item.name}
        </div>
        {(item.note || item.quantity) && (
          <div className={`text-xs mt-0.5 ${checked ? 'line-through' : ''}`} style={{ color: '#a0937e' }}>
            {[item.note, item.quantity && `× ${item.quantity}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* checkbox */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggle(item); }}
        className="w-7 h-7 flex items-center justify-center shrink-0"
        aria-label={checked ? '取消勾选' : '勾选'}
      >
        {checked ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#7ca982' }}>
            <span className="text-white text-xs">✓</span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: '#d5cbbe' }} />
        )}
      </button>

      {/* menu */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onMenu(item); }}
        className="w-6 h-6 flex items-center justify-center active:opacity-50 shrink-0"
        style={{ color: '#c4b49a' }}
        aria-label="更多操作"
      >
        ⋮
      </button>
    </div>
  );
}
