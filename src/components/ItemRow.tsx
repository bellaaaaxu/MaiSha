import { useDraggable } from '@dnd-kit/core';
import type { Item } from '@/types/item';

interface Props {
  item: Item;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}

export function ItemRow({ item, onToggle, onMenu }: Props) {
  const checked = item.checked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item }
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{ touchAction: 'manipulation' }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 ${
        checked ? 'bg-gray-100' : 'bg-white'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggle(item)}
        className={`w-7 h-7 flex items-center justify-center text-lg shrink-0 ${
          checked ? 'text-primary' : 'text-gray-300'
        }`}
        aria-label={checked ? '取消勾选' : '勾选'}
      >
        {checked ? '✓' : '○'}
      </button>

      {/* 中间文字区：长按这里才拖动；快速点也可勾选 */}
      <div
        {...listeners}
        onClick={() => onToggle(item)}
        className="flex-1 min-w-0 cursor-grab active:cursor-grabbing select-none"
      >
        <div className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.name}
          {item.note && <span className="text-xs text-gray-500 ml-1">· {item.note}</span>}
        </div>
        {item.quantity && (
          <div className={`text-xs mt-0.5 ${checked ? 'line-through text-gray-400' : 'text-gray-500'}`}>
            × {item.quantity}
          </div>
        )}
      </div>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onMenu(item); }}
        className="w-8 h-8 flex items-center justify-center text-gray-400 active:opacity-50 shrink-0"
        aria-label="更多操作"
      >
        ⋮
      </button>
    </div>
  );
}
