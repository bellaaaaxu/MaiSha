import { useNavigate } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ItemGrid } from './ItemGrid';
import type { StoreGroup } from '@/utils/group-items';
import type { Store } from '@/types/store';

interface Props {
  group: StoreGroup;
  customIconMap?: Map<string, string>;
  supermarkets?: Store[];
  onUpdateNote?: (itemId: string, note: string) => void;
  onUpdateStore?: (itemId: string, storeId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onAddItem?: (storeId: string) => void;
  colorIndex?: number;
  dragging?: boolean;
}

const BORDER_COLORS = ['var(--accent-soft)', 'var(--green-soft)', 'var(--blue)'];

export function StoreCard({ group, customIconMap, supermarkets, onUpdateNote, onUpdateStore, onDeleteItem, onAddItem, colorIndex = 0, dragging }: Props) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
            {t('list.items', { count: group.totalCount })}
          </span>
          {onAddItem && (
            <button
              onClick={() => onAddItem(group.store.id)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1.5px dashed var(--ink-faint)',
                background: 'none',
                color: 'var(--ink-light)',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label={`添加到${group.store.name}`}
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Item grid */}
      {group.items.length > 0 && (
        <ItemGrid
          items={group.items}
          customIconMap={customIconMap}
          supermarkets={supermarkets}
          onUpdateNote={onUpdateNote}
          onUpdateStore={onUpdateStore}
          onDeleteItem={onDeleteItem}
          dragging={dragging}
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
