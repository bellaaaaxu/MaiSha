import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { updateListSupermarkets } from '@/lib/db';
import { UNDELETABLE_SUPERMARKET_ID } from '@/utils/constants';
import type { Supermarket } from '@/types/supermarket';

export default function ManageMarkets() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);

  const [items, setItems] = useState<Supermarket[]>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const hasChanges = useMemo(() => {
    if (!list) return false;
    return JSON.stringify(items) !== JSON.stringify(list.supermarkets);
  }, [items, list]);

  useEffect(() => {
    if (list) setItems(JSON.parse(JSON.stringify(list.supermarkets)));
  }, [list]);

  // Custom markets are sortable; "未分类" is pinned at the bottom
  const customMarkets = useMemo(
    () => items.filter(s => s.id !== UNDELETABLE_SUPERMARKET_ID),
    [items]
  );
  const fallbackMarket = useMemo(
    () => items.find(s => s.id === UNDELETABLE_SUPERMARKET_ID),
    [items]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  if (!list) return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;

  const rename = (id: string, val: string) => {
    setItems(items.map(s => s.id === id ? { ...s, name: val } : s));
  };

  const remove = (id: string) => {
    if (id === UNDELETABLE_SUPERMARKET_ID) {
      alert('"未分类"不可删');
      return;
    }
    if (!confirm('删除这个超市？已分配到这里的物品会回到"未分类"。')) return;
    setItems(items.filter(s => s.id !== id));
  };

  const add = () => {
    if (!newName.trim()) return;
    const newMarket: Supermarket = {
      id: 'sm_' + Date.now().toString(36),
      name: newName.trim(),
      emoji: '🏪',  // kept in data model for backward compat, not displayed
    };
    // Insert before "未分类"
    setItems([...customMarkets, newMarket, ...(fallbackMarket ? [fallbackMarket] : [])]);
    setNewName('');
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = customMarkets.findIndex(s => s.id === active.id);
    const newIndex = customMarkets.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(customMarkets, oldIndex, newIndex);
    setItems([...reordered, ...(fallbackMarket ? [fallbackMarket] : [])]);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Persist: custom markets in their reordered sequence, "未分类" at the end
      const toSave = [...customMarkets, ...(fallbackMarket ? [fallbackMarket] : [])];
      await updateListSupermarkets(list.id, toSave);
      nav(-1);
    } catch {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (hasChanges) {
      setShowUnsavedConfirm(true);
    } else {
      nav(-1);
    }
  };

  const discardAndLeave = () => {
    setShowUnsavedConfirm(false);
    nav(-1);
  };

  const saveAndLeave = async () => {
    setShowUnsavedConfirm(false);
    await save();
  };

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10 gap-3"
        style={{
          background: 'rgba(250,246,240,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        <button
          onClick={onBack}
          className="text-xl active:opacity-60"
          style={{ color: '#a0937e' }}
          aria-label="返回"
        >
          ←
        </button>
        <div className="flex-1 text-base font-semibold" style={{ color: '#5a4e3c' }}>
          管理超市
        </div>
      </header>

      <main className="p-4">
        <div className="text-xs mb-3 px-1" style={{ color: '#a0937e' }}>
          长按 <span style={{ color: '#7ca982' }}>⋮⋮</span> 拖动排序，"未分类"固定在底部
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={customMarkets.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {customMarkets.map(s => (
              <SortableRow
                key={s.id}
                market={s}
                onRename={(v) => rename(s.id, v)}
                onRemove={() => remove(s.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Fallback "未分类" row (not draggable, pinned at bottom) */}
        {fallbackMarket && (
          <div
            className="flex items-center gap-3 rounded-2xl p-3 mb-2"
            style={{
              background: 'rgba(245,238,228,0.6)',
              border: '1px dashed rgba(215,205,188,0.5)',
            }}
          >
            <span style={{ color: '#c4b49a' }}>🔒</span>
            <span className="flex-1 text-sm" style={{ color: '#a0937e' }}>
              {fallbackMarket.name}
            </span>
            <span className="text-[10px]" style={{ color: '#c4b49a' }}>系统 · 固定底部</span>
          </div>
        )}

        {/* Add new */}
        <div className="flex gap-2 mt-5 mb-3">
          <input
            className="flex-1 px-3 py-3 rounded-xl text-sm outline-none"
            style={{
              background: 'rgba(255,252,247,0.8)',
              border: '1px solid rgba(215,205,188,0.4)',
              color: '#5a4e3c',
            }}
            placeholder="新超市名（如：Walmart）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <button
            onClick={add}
            disabled={!newName.trim()}
            className="px-4 rounded-xl text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
            style={{ background: '#7ca982' }}
          >
            添加
          </button>
        </div>
      </main>

      <footer
        className="fixed left-0 right-0 bottom-0 mx-auto max-w-mobile px-4 py-3"
        style={{ background: 'linear-gradient(to top, #f3ede4 60%, transparent)' }}
      >
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90 disabled:opacity-50"
          style={{ background: '#7ca982' }}
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </footer>

      {/* Unsaved-changes confirmation */}
      {showUnsavedConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowUnsavedConfirm(false)}
        >
          <div
            className="mx-6 w-full max-w-xs rounded-3xl p-6"
            style={{
              background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
              border: '1px solid rgba(215,205,188,0.5)',
              boxShadow: '0 8px 32px rgba(100,80,50,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="text-base font-semibold mb-2" style={{ color: '#5a4e3c' }}>
                有未保存的修改
              </div>
              <div className="text-xs" style={{ color: '#8a7e6b' }}>
                你的修改还没有保存，确定要离开吗？
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={saveAndLeave}
                disabled={saving}
                className="w-full h-11 rounded-xl text-sm font-medium text-white active:opacity-90 disabled:opacity-50"
                style={{ background: '#7ca982' }}
              >
                {saving ? '保存中…' : '保存并返回'}
              </button>
              <button
                onClick={discardAndLeave}
                className="w-full h-11 rounded-xl text-sm font-medium active:opacity-80"
                style={{
                  background: 'rgba(255,252,247,0.6)',
                  border: '1px solid rgba(215,205,188,0.4)',
                  color: '#c97b63',
                }}
              >
                不保存，直接返回
              </button>
              <button
                onClick={() => setShowUnsavedConfirm(false)}
                className="w-full h-11 rounded-xl text-sm font-medium active:opacity-80"
                style={{ color: '#8a7e6b' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableRowProps {
  market: Supermarket;
  onRename: (val: string) => void;
  onRemove: () => void;
}

function SortableRow({ market, onRename, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: market.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: 'rgba(255,252,247,0.7)',
    border: '1px solid rgba(215,205,188,0.4)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-2xl p-3 mb-2"
    >
      {/* Drag handle (only this area triggers drag, so input stays editable) */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing select-none touch-none px-1"
        style={{ color: '#c4b49a' }}
        aria-label="拖动排序"
      >
        ⋮⋮
      </button>
      <input
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: '#5a4e3c' }}
        value={market.name}
        onChange={(e) => onRename(e.target.value)}
      />
      <button
        onClick={onRemove}
        className="text-xs px-2 py-1 rounded-lg active:opacity-60"
        style={{ color: '#c97b63' }}
      >
        删除
      </button>
    </div>
  );
}
