import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { ItemRow } from './ItemRow';
import type { StoreGroup } from '@/utils/group-items';
import type { Item } from '@/types/item';

interface Props {
  group: StoreGroup;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  onMenu: (item: Item) => void;
}

export function SupermarketCard({ group, customIconMap, onToggle, onMenu }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const { isOver, setNodeRef } = useDroppable({ id: group.store.id });
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
      <div
        onClick={() => !isEmpty && setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 ${
          isEmpty ? '' : 'pb-2 mb-2 cursor-pointer'
        }`}
        style={isEmpty ? {} : { borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <span
          className="text-base font-semibold"
          style={{ color: isEmpty ? '#a0937e' : '#5a4e3c' }}
        >
          {group.store.name}
        </span>
        {isEmpty ? (
          <span className="ml-auto text-xs" style={{ color: '#c4b49a' }}>拖到这里换超市</span>
        ) : (
          <>
            <span className="text-xs ml-1" style={{ color: '#a0937e' }}>· {group.totalCount}项</span>
            <span className="ml-auto flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nav(`/shopping/${group.store.id}`);
                }}
                className="px-3 py-1 rounded-full text-xs font-medium text-white active:opacity-80"
                style={{ background: '#7ca982' }}
              >
                去购物
              </button>
              <span className="text-xs" style={{ color: '#c4b49a' }}>{collapsed ? '▸' : '▾'}</span>
            </span>
          </>
        )}
      </div>
      {!collapsed && !isEmpty && (
        <div>
          {group.items.map(item => (
            <ItemRow key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} onMenu={onMenu} />
          ))}
        </div>
      )}
    </div>
  );
}
