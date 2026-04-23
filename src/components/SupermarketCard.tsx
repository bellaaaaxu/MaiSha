import { useState } from 'react';
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
  return (
    <div className="bg-white rounded-xl p-4 mb-3">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 pb-2 mb-2 border-b border-gray-100"
      >
        <span className="text-base">{group.supermarket.emoji}</span>
        <span className="text-base font-semibold">{group.supermarket.name}</span>
        <span className="text-xs text-gray-400 ml-1">· {group.totalCount}项</span>
        <span className="ml-auto text-gray-300 text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
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
