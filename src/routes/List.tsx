import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { useUndoToast } from '@/hooks/useUndoToast';
import { StoreCard } from '@/components/StoreCard';
import { AddSheet } from '@/components/AddSheet';
import { ItemMenu } from '@/components/ItemMenu';
import { SetIconSheet } from '@/components/SetIconSheet';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { UndoToast } from '@/components/UndoToast';
import { ImportSheet } from '@/components/ImportSheet';
import PurchaseHistory from '@/routes/PurchaseHistory';
import { groupItemsByStore } from '@/utils/group-items';
import { addItem, updateItem, deleteItem } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import type { Item, NewItemInput } from '@/types/item';

export default function ListRoute() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const joinListId = params.get('list');

  const { uid } = useAuth();
  const { list, loading: listLoading, error: listErr } = useList(uid, joinListId);
  const { items, loading: itemsLoading } = useItems(list?.id ?? null);
  const { iconMap: customIconMap, refresh: refreshIcons } = useCustomIcons(list?.id ?? null);

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menuItem, setMenuItem] = useState<Item | null>(null);
  const [setIconItem, setSetIconItem] = useState<Item | null>(null);
  const [draggingItem, setDraggingItem] = useState<Item | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
  const { t } = useTranslation();
  const undoToast = useUndoToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } })
  );

  // 拖拽中显示所有超市（含空），方便放入空超市
  const groups = useMemo(
    () => (list ? groupItemsByStore(items, list.supermarkets, !!draggingItem) : []),
    [items, list, draggingItem]
  );
  if (listLoading || itemsLoading) {
    return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;
  }
  if (listErr) {
    return <div className="p-8 text-center text-danger text-sm">{listErr}</div>;
  }
  if (!list || !uid) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: '#a0937e' }}>
        找不到这个清单，请让家人重新分享链接
      </div>
    );
  }

  const onAdd = async (input: NewItemInput): Promise<string> => {
    const item = await addItem(list.id, uid, input);
    recordItemUsage(uid, {
      name: input.name,
      note: input.note ?? '',
      supermarket: input.supermarket ?? 'none',
      category_emoji: '📦',
    });
    return item.id;
  };

  const onRemoveAdded = async (itemId: string) => {
    await deleteItem(itemId);
  };

  const onShareMenu = async () => {
    const code = list.short_code;
    const text = code
      ? `邀请码：${code}\n或打开链接：${location.origin}/list?list=${list.id}`
      : `${location.origin}/list?list=${list.id}`;
    try {
      await navigator.clipboard.writeText(text);
      alert(code ? `邀请码已复制！\n\n${code}\n\n发给家人，输入邀请码即可加入` : '邀请链接已复制！');
    } catch {
      prompt('复制：', text);
    }
  };

  const onImport = async (inputs: NewItemInput[]) => {
    let count = 0;
    for (const input of inputs) {
      try {
        await addItem(list.id, uid, input);
        count++;
      } catch { /* skip failed */ }
    }
    if (count > 0) {
      undoToast.show(`已导入 ${count} 项`, () => {});
    }
  };

  const onMenuDelete = async (item: Item) => {
    try {
      await deleteItem(item.id);
      undoToast.show(`已删除「${item.name}」`, async () => {
        try {
          await addItem(list.id, uid, {
            name: item.name,
            note: item.note,
            quantity: item.quantity,
            supermarket: item.supermarket,
          });
        } catch { /* silent */ }
      });
    } catch {
      alert('删除失败');
    }
  };

  const onMenuDuplicate = async (item: Item) => {
    try {
      await addItem(list.id, uid, {
        name: item.name, note: item.note, quantity: item.quantity,
        supermarket: item.supermarket,
      });
    } catch { alert('复制失败'); }
  };

  const onMenuEdit = (item: Item) => {
    nav(`/edit-item/${item.id}`);
  };

  const onMenuSetIcon = (item: Item) => {
    setSetIconItem(item);
  };

  const onDragStart = (e: DragStartEvent) => {
    const item = e.active.data.current?.item as Item | undefined;
    if (item) setDraggingItem(item);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setDraggingItem(null);
    const { active, over } = e;
    if (!over) return;

    const item = active.data.current?.item as Item | undefined;
    if (!item) return;

    const newMarketId = String(over.id);
    if (newMarketId === item.supermarket) return;

    try {
      await updateItem(item.id, { supermarket: newMarketId });
    } catch {
      alert('切换超市失败');
    }
  };

  const onDragCancel = () => setDraggingItem(null);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div
        className="min-h-screen pb-8"
        style={{ background: 'var(--paper)' }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 24px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-title)',
            fontSize: 34,
            color: 'var(--ink)',
            letterSpacing: 3,
          }}>
            {t('app.title')}
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={onShareMenu} style={{
              fontFamily: 'var(--font-body)', fontSize: 15,
              color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              {t('header.joinList')}
            </button>
            <button onClick={() => setShowSettings(true)} style={{
              fontSize: 20, color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              ⚙
            </button>
          </div>
        </div>

        {/* Dashed divider */}
        <div style={{
          margin: '0 24px', height: 2, opacity: 0.5,
          background: 'repeating-linear-gradient(90deg, var(--ink-faint) 0px, var(--ink-faint) 6px, transparent 6px, transparent 10px)',
        }} />

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '10px 24px 4px' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 15, cursor: 'pointer',
              padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
              fontWeight: activeTab === 'list' ? 700 : 500,
              color: activeTab === 'list' ? 'var(--ink)' : 'var(--ink-faint)',
              background: activeTab === 'list' ? 'rgba(232, 174, 151, 0.15)' : 'none',
            }}
          >
            {t('nav.list')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 15, cursor: 'pointer',
              padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
              fontWeight: activeTab === 'history' ? 700 : 500,
              color: activeTab === 'history' ? 'var(--ink)' : 'var(--ink-faint)',
              background: activeTab === 'history' ? 'rgba(232, 174, 151, 0.15)' : 'none',
            }}
          >
            {t('nav.history')}
          </button>
        </div>

        {/* Main content */}
        {activeTab === 'list' && (
          <>
            {groups.length === 0 ? (
              <div style={{ padding: '96px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                <div style={{ fontSize: 16, color: 'var(--ink-faint)' }}>{t('list.emptyTitle')}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ink-faint)' }}>{t('list.emptySubtitle')}</div>
              </div>
            ) : (
              groups.map((group, i) => (
                <StoreCard
                  key={group.store.id}
                  group={group}
                  customIconMap={customIconMap}
                  onItemTap={(item) => setMenuItem(item)}
                  colorIndex={i}
                />
              ))
            )}
            {/* Add item area */}
            <div
              onClick={() => setShowAdd(true)}
              style={{
                margin: '16px 18px',
                padding: '14px 18px',
                border: '2px dashed var(--ink-faint)',
                borderRadius: 'var(--radius-card)',
                textAlign: 'center',
                color: 'var(--ink-light)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                opacity: 0.6,
              }}
            >
              {t('list.addItem')}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <PurchaseHistory />
        )}

        <AddSheet
          open={showAdd}
          uid={uid}
          listId={list.id}
          supermarkets={list.supermarkets}
          customIconMap={customIconMap}
          onClose={() => setShowAdd(false)}
          onAdd={onAdd}
          onRemove={onRemoveAdded}
          onIconsChanged={refreshIcons}
          onOpenImport={() => { setShowAdd(false); setShowImport(true); }}
        />

        <ItemMenu
          item={menuItem}
          onClose={() => setMenuItem(null)}
          onEdit={onMenuEdit}
          onDelete={onMenuDelete}
          onDuplicate={onMenuDuplicate}
          onSetIcon={onMenuSetIcon}
        />

        <SetIconSheet
          item={setIconItem}
          uid={uid}
          listId={list.id}
          onClose={() => setSetIconItem(null)}
          onIconsChanged={refreshIcons}
        />

        <ImportSheet
          open={showImport}
          supermarkets={list.supermarkets}
          onClose={() => setShowImport(false)}
          onImport={onImport}
        />

        <UndoToast
          toast={undoToast.toast}
          onUndo={undoToast.undo}
          onDismiss={undoToast.dismiss}
        />

        <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
      </div>

      <DragOverlay>
        {draggingItem ? (
          <div className="bg-white rounded-lg shadow-xl px-3 py-2.5 flex items-center gap-3 max-w-xs">
            <span className="w-7 h-7 flex items-center justify-center text-lg text-gray-300">
              {draggingItem.checked ? '✓' : '○'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                {draggingItem.name}
                {draggingItem.note && (
                  <span className="text-xs text-gray-500 ml-1">· {draggingItem.note}</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
