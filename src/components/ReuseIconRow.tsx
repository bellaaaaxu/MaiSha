import { getPublicIconUrl, type ReusableIcon } from '@/lib/custom-icons';

interface Props {
  itemName: string;
  reusable: ReusableIcon[];
  onPick: (icon: ReusableIcon) => void;
  onViewAll: () => void;
}

const ROW_LIMIT = 8;

export function ReuseIconRow({ itemName, reusable, onPick, onViewAll }: Props) {
  if (reusable.length === 0) return null;
  const shown = reusable.slice(0, ROW_LIMIT);
  return (
    <div
      className="rounded-2xl p-3.5 mb-3"
      style={{ background: 'rgba(255,252,247,0.8)', border: '1px solid rgba(215,205,188,0.5)' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs" style={{ color: '#8a6d50' }}>
          给「{itemName}」选一张现成图
        </span>
        {reusable.length > ROW_LIMIT && (
          <button onClick={onViewAll} className="text-xs active:opacity-60" style={{ color: '#7ca982' }}>
            查看全部 ›
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {shown.map(icon => (
          <button
            key={icon.id}
            onClick={() => onPick(icon)}
            className="shrink-0 rounded-xl p-1.5 active:scale-95 transition-transform"
            style={{ background: 'white', border: '1px solid rgba(215,205,188,0.4)' }}
            aria-label={icon.name}
          >
            <img
              src={getPublicIconUrl(icon.image_path)}
              alt={icon.name}
              draggable={false}
              className="w-12 h-12 object-contain pointer-events-none"
              style={{ mixBlendMode: 'multiply' }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
