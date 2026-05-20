import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ItemRow } from './ItemRow';
import type { MarketGroup } from '@/utils/group-items';
import type { Item } from '@/types/item';

interface Props {
  group: MarketGroup;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  '蔬菜': '#7ca982',
  '肉蛋': '#c97b63',
  '乳制品': '#d4a96a',
  '主食': '#8b9dc3',
  '调料': '#b08d57',
  '日用': '#9b8ec0',
  '烘焙': '#c9886d',
  '饮料': '#6a9fb5',
  '水果': '#d4a06a',
  '零食': '#c98a8a',
  '其他': '#999',
};

export function SupermarketCard({ group, customIconMap, onToggle, onMenu }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { isOver, setNodeRef } = useDroppable({ id: group.supermarket.id });
  const isEmpty = group.totalCount === 0;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl p-4 mb-3 transition-all ${
        isOver ? 'ring-2' : ''
      }`}
      style={{
        background: isOver
          ? 'rgba(124,169,130,0.1)'
          : isEmpty
          ? 'rgba(255,252,247,0.3)'
          : 'rgba(255,252,247,0.5)',
        border: isEmpty
          ? '2px dashed rgba(215,205,188,0.5)'
          : '1px solid rgba(215,205,188,0.35)',
        ...(isOver ? { ringColor: '#7ca982' } : {}),
      }}
    >
      <button
        onClick={() => !isEmpty && setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 ${
          isEmpty ? '' : 'pb-2 mb-2'
        }`}
        style={isEmpty ? {} : { borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <span className="text-base">{group.supermarket.emoji}</span>
        <span
          className="text-base font-semibold"
          style={{ color: isEmpty ? '#a0937e' : '#5a4e3c' }}
        >
          {group.supermarket.name}
        </span>
        {isEmpty ? (
          <span className="ml-auto text-xs" style={{ color: '#c4b49a' }}>拖到这里换超市</span>
        ) : (
          <>
            <span className="text-xs ml-1" style={{ color: '#a0937e' }}>· {group.totalCount}项</span>
            <span className="ml-auto text-xs" style={{ color: '#c4b49a' }}>{collapsed ? '▸' : '▾'}</span>
          </>
        )}
      </button>
      {!collapsed && !isEmpty && (
        <div>
          {group.categories.map(cat => (
            <div key={cat.category}>
              <div className="flex items-center gap-1.5 mt-2 mb-1.5 px-1">
                <div
                  className="w-1 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#999' }}
                />
                <span className="text-xs font-medium" style={{ color: '#a0937e' }}>
                  {cat.category}
                </span>
              </div>
              {cat.items.map(item => (
                <ItemRow key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} onMenu={onMenu} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
