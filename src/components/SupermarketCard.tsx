import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ItemRow } from './ItemRow';
import type { MarketGroup } from '@/utils/group-items';
import type { Item } from '@/types/item';

interface Props {
  group: MarketGroup;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}

export function SupermarketCard({ group, onToggle, onMenu }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { isOver, setNodeRef } = useDroppable({ id: group.supermarket.id });
  const isEmpty = group.totalCount === 0;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-4 mb-3 transition-all ${
        isOver
          ? 'bg-green-50 ring-2 ring-primary'
          : isEmpty
          ? 'bg-gray-50 border-2 border-dashed border-gray-300'
          : 'bg-white'
      }`}
    >
      <button
        onClick={() => !isEmpty && setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 ${
          isEmpty ? '' : 'pb-2 mb-2 border-b border-gray-100'
        }`}
      >
        <span className="text-base">{group.supermarket.emoji}</span>
        <span className={`text-base font-semibold ${isEmpty ? 'text-gray-500' : ''}`}>
          {group.supermarket.name}
        </span>
        {isEmpty ? (
          <span className="ml-auto text-xs text-gray-400">拖到这里换超市</span>
        ) : (
          <>
            <span className="text-xs text-gray-400 ml-1">· {group.totalCount}项</span>
            <span className="ml-auto text-gray-300 text-xs">{collapsed ? '▸' : '▾'}</span>
          </>
        )}
      </button>
      {!collapsed && !isEmpty && (
        <div>
          {group.categories.map(cat => (
            <div key={cat.category}>
              <div className="text-xs text-gray-400 font-semibold mt-2 mb-1.5">
                {cat.emoji} {cat.category}
              </div>
              {cat.items.map(item => (
                <ItemRow key={item.id} item={item} onToggle={onToggle} onMenu={onMenu} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
