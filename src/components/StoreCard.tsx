import { useNavigate } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ItemGrid } from './ItemGrid';
import type { StoreGroup } from '@/utils/group-items';
import type { Item } from '@/types/item';

interface Props {
  group: StoreGroup;
  customIconMap?: Map<string, string>;
  onItemTap?: (item: Item) => void;
  colorIndex?: number;
}

const BORDER_COLORS = ['var(--accent-soft)', 'var(--green-soft)', 'var(--blue)'];

export function StoreCard({ group, customIconMap, onItemTap, colorIndex = 0 }: Props) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: group.store.id });
  const borderColor = BORDER_COLORS[colorIndex % BORDER_COLORS.length];

  return (
    <div
      ref={setNodeRef}
      style={{
        margin: '12px 18px',
        padding: '16px 18px 12px',
        background: 'white',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        borderLeft: `4px solid ${borderColor}`,
        opacity: isOver ? 0.95 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Store header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: 'var(--font-title)',
          fontSize: 22,
          color: 'var(--ink)',
        }}>
          {group.store.name}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          {t('list.items', { count: group.totalCount })}
        </span>
      </div>

      {/* Item grid */}
      {group.items.length > 0 && (
        <ItemGrid
          items={group.items}
          customIconMap={customIconMap}
          onItemTap={onItemTap}
        />
      )}

      {/* Go shopping button */}
      {group.items.length > 0 && (
        <button
          onClick={() => nav(`/shopping/${group.store.id}`)}
          style={{
            display: 'inline-block',
            marginTop: 8,
            padding: '5px 16px',
            background: 'var(--paper)',
            border: '1.5px solid var(--ink-faint)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink-light)',
            cursor: 'pointer',
          }}
        >
          {t('list.goShopping')} →
        </button>
      )}
    </div>
  );
}
