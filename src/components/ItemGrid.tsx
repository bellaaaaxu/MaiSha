import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from './WatercolorFallback';
import type { Item } from '@/types/item';

interface Props {
  items: Item[];
  customIconMap?: Map<string, string>;
  onUpdateNote?: (itemId: string, note: string) => void;
  onDeleteItem?: (itemId: string) => void;
  dragging?: boolean;
}

interface CellProps {
  item: Item;
  customIconMap?: Map<string, string>;
  isEditing: boolean;
  onTap: () => void;
}

function ItemCell({ item, customIconMap, isEditing, onTap }: CellProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const iconUrl = resolveIconUrl(item.name, customIconMap);
  const displayNote = item.note || (item.quantity ? `x${item.quantity}` : '');

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: isDragging ? 'grabbing' : 'pointer',
        opacity: isDragging ? 0.3 : 1,
        transition: 'opacity 0.15s',
        borderRadius: 8,
        padding: '4px 2px',
        background: isEditing ? 'rgba(232, 174, 151, 0.1)' : 'transparent',
      }}
    >
      <div style={{ position: 'relative' }}>
        {displayNote && (
          <span style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            fontSize: 9,
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            color: 'var(--ink)',
            background: 'rgba(232, 174, 151, 0.25)',
            padding: '0 5px',
            borderRadius: 6,
            lineHeight: '14px',
            whiteSpace: 'nowrap',
            maxWidth: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {displayNote}
          </span>
        )}
        <div style={{
          width: 52, height: 52,
          borderRadius: 'var(--radius-icon)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-icon)',
          background: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {iconUrl
            ? <img src={iconUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <WatercolorFallback name={item.name} size={52} category="其他" />}
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12, fontWeight: 500,
        color: 'var(--ink)',
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: 64,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.name}
      </span>
    </div>
  );
}

const COLS = 4;

export function ItemGrid({ items, customIconMap, onUpdateNote, onDeleteItem, dragging }: Props) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dragging) setEditingId(null);
  }, [dragging]);

  const editIdx = editingId ? items.findIndex(i => i.id === editingId) : -1;
  const editorAfterIdx = editIdx >= 0
    ? Math.min(Math.floor(editIdx / COLS) * COLS + COLS - 1, items.length - 1)
    : -1;

  const openEditor = (item: Item) => {
    if (editingId === item.id) {
      setEditingId(null);
    } else {
      setEditingId(item.id);
      setNoteInput(item.note || '');
      setTimeout(() => {
        inputRef.current?.focus();
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const handleConfirm = () => {
    if (editingId) onUpdateNote?.(editingId, noteInput.trim());
    setEditingId(null);
  };

  const handleDelete = () => {
    if (editingId) onDeleteItem?.(editingId);
    setEditingId(null);
  };

  const elements: React.ReactNode[] = [];

  items.forEach((item, idx) => {
    elements.push(
      <ItemCell
        key={item.id}
        item={item}
        customIconMap={customIconMap}
        isEditing={item.id === editingId}
        onTap={() => openEditor(item)}
      />
    );

    if (idx === editorAfterIdx && editingId) {
      const editingItem = items[editIdx];
      elements.push(
        <div
          key="inline-editor"
          ref={editorRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 2px',
            margin: '2px 0',
            borderTop: '1px dashed rgba(196, 180, 154, 0.3)',
            borderBottom: '1px dashed rgba(196, 180, 154, 0.3)',
          }}
        >
          <span style={{
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--ink-light)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {editingItem.name}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            maxLength={5}
            placeholder={t('item.notePlaceholder')}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              padding: '5px 10px',
              border: '1.5px solid var(--ink-faint)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
          <button onClick={handleConfirm} style={{
            width: 28, height: 28,
            borderRadius: '50%', border: 'none',
            background: 'rgba(124, 169, 130, 0.15)',
            color: '#7ca982', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            ✓
          </button>
          <button onClick={() => setEditingId(null)} style={{
            width: 28, height: 28,
            borderRadius: '50%', border: 'none',
            background: 'rgba(160, 147, 126, 0.1)',
            color: 'var(--ink-faint)', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            ✗
          </button>
          <button onClick={handleDelete} style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'rgba(200, 80, 80, 0.1)',
            color: '#c06060',
            fontFamily: 'var(--font-body)',
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {t('common.delete')}
          </button>
        </div>
      );
    }
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 10,
      marginBottom: 10,
    }}>
      {elements}
    </div>
  );
}
