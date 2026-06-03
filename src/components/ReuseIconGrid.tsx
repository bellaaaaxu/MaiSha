import { useState } from 'react';
import { getPublicIconUrl, type ReusableIcon } from '@/lib/custom-icons';
import { matchesIconQuery } from '@/utils/icon-registry';

interface Props {
  itemName: string;
  reusable: ReusableIcon[];
  onPick: (icon: ReusableIcon) => void;
  onClose: () => void;
}

export function ReuseIconGrid({ itemName, reusable, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const filtered = reusable.filter(i => matchesIconQuery(i, q));
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      <header
        className="px-4 py-3 flex items-center gap-3 sticky top-0"
        style={{
          background: 'rgba(250,246,240,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        <button onClick={onClose} className="text-xl active:opacity-60" style={{ color: '#a0937e' }} aria-label="返回">
          ←
        </button>
        <div className="flex-1 text-sm font-semibold" style={{ color: '#5a4e3c' }}>
          给「{itemName}」选图
        </div>
      </header>
      <div className="px-4 py-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索图标"
          className="w-full rounded-full px-4 py-2.5 text-sm outline-none"
          style={{ background: 'rgba(255,252,247,0.8)', border: '1px solid rgba(215,205,188,0.4)', color: '#5a4e3c' }}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-4 gap-2.5">
          {filtered.map(icon => (
            <button
              key={icon.id}
              onClick={() => onPick(icon)}
              className="flex flex-col items-center rounded-xl p-2 active:scale-95 transition-transform"
              style={{ background: 'white', border: '1px solid rgba(215,205,188,0.4)' }}
            >
              <img
                src={getPublicIconUrl(icon.image_path)}
                alt={icon.name}
                draggable={false}
                className="w-12 h-12 object-contain pointer-events-none"
                style={{ mixBlendMode: 'multiply' }}
              />
              <span className="text-[10px] mt-1 truncate w-full text-center" style={{ color: '#5a4e3c' }}>
                {icon.name}
              </span>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: '#a0937e' }}>没有匹配的图标</p>
        )}
      </div>
    </div>
  );
}
