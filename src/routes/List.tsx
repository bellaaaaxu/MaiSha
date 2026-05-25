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
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { useUndoToast } from '@/hooks/useUndoToast';
import { useOffline } from '@/hooks/useOffline';
import { SupermarketCard } from '@/components/SupermarketCard';
import { AddSheet } from '@/components/AddSheet';
import { ItemMenu } from '@/components/ItemMenu';
import { SetIconSheet } from '@/components/SetIconSheet';
import { MoreMenu } from '@/components/MoreMenu';
import { ConfirmModal } from '@/components/ConfirmModal';
import { UndoToast } from '@/components/UndoToast';
import { ImportSheet } from '@/components/ImportSheet';
import { groupItemsByMarketAndCategory } from '@/utils/group-items';
import { addItem, updateItem, deleteItem, clearChecked } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import { generateShareText } from '@/utils/share-text';
import { getEmptyListText, getEmptyListSubtext, getHeaderSubtext, getFinishShoppingText } from '@/utils/warm-copy';
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
  const [showMore, setShowMore] = useState(false);
  const [menuItem, setMenuItem] = useState<Item | null>(null);
  const [setIconItem, setSetIconItem] = useState<Item | null>(null);
  const [draggingItem, setDraggingItem] = useState<Item | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const undoToast = useUndoToast();
  const { isOffline } = useOffline();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } })
  );

  // 拖拽中显示所有超市（含空），方便放入空超市
  const groups = useMemo(
    () => (list ? groupItemsByMarketAndCategory(items, list.supermarkets, !!draggingItem) : []),
    [items, list, draggingItem]
  );
  const uncheckedCount = items.filter(i => !i.checked).length;
  const checkedCount = items.length - uncheckedCount;

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

  const onToggle = async (item: Item) => {
    const wasChecked = item.checked;
    try {
      await updateItem(item.id, {
        checked: !wasChecked,
        checked_at: !wasChecked ? new Date().toISOString() : null
      });
      if (!wasChecked) {
        undoToast.show(`已勾选「${item.name}」`, async () => {
          try {
            await updateItem(item.id, { checked: false, checked_at: null });
          } catch { /* silent */ }
        });
      }
    } catch {
      alert('操作失败');
    }
  };

  const onAdd = async (input: NewItemInput): Promise<string> => {
    const item = await addItem(list.id, uid, input);
    recordItemUsage(uid, {
      name: input.name,
      note: input.note ?? '',
      supermarket: input.supermarket ?? 'none',
      category_emoji: input.category_emoji ?? '📦'
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

  const onFinishShopping = async () => {
    setShowFinishConfirm(false);
    try {
      await clearChecked(list.id);
    } catch {
      alert('操作失败');
    }
  };

  const onCopyShareText = async () => {
    const text = generateShareText(items, list.supermarkets);
    try {
      await navigator.clipboard.writeText(text);
      alert('清单文本已复制');
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
            category: item.category,
            category_emoji: item.category_emoji,
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
        supermarket: item.supermarket, category: item.category,
        category_emoji: item.category_emoji
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
        className="min-h-screen pb-36"
        style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
      >
        <header
          className="px-4 py-3 flex items-center sticky top-0 z-10"
          style={{
            background: 'rgba(250,246,240,0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(215,205,188,0.3)',
          }}
        >
          <div className="flex-1">
            <div className="text-lg font-semibold flex items-center gap-2" style={{ color: '#5a4e3c' }}>
              买啥
              {isOffline && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(201,123,99,0.15)', color: '#c97b63' }}
                >
                  📡 离线模式
                </span>
              )}
            </div>
            <div className="text-xs" style={{ color: '#a0937e' }}>
              {getHeaderSubtext(uncheckedCount)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => nav('/icons')}
              className="flex items-center justify-center text-lg rounded-xl active:opacity-80 active:scale-95 transition-all"
              style={{
                minWidth: 40,
                minHeight: 40,
                padding: '6px 10px',
                background: 'rgba(255,252,247,0.7)',
                border: '1px solid rgba(215,205,188,0.4)',
              }}
              aria-label="图标管理"
            >🎨</button>
            <button
              onClick={onShareMenu}
              className="flex items-center justify-center text-lg rounded-xl active:opacity-80 active:scale-95 transition-all"
              style={{
                minWidth: 40,
                minHeight: 40,
                padding: '6px 10px',
                background: 'rgba(255,252,247,0.7)',
                border: '1px solid rgba(215,205,188,0.4)',
              }}
              aria-label="分享"
            >📤</button>
            <button
              onClick={() => setShowMore(true)}
              className="flex items-center justify-center text-lg rounded-xl active:opacity-80 active:scale-95 transition-all"
              style={{
                minWidth: 40,
                minHeight: 40,
                padding: '6px 10px',
                background: 'rgba(255,252,247,0.7)',
                border: '1px solid rgba(215,205,188,0.4)',
              }}
              aria-label="更多"
            >⚙️</button>
          </div>
        </header>

        <main className="p-4">
          {groups.length === 0 ? (
            <div className="py-24 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <div className="text-base" style={{ color: '#a0937e' }}>{getEmptyListText()}</div>
              <div className="text-xs mt-1" style={{ color: '#c4b49a' }}>{getEmptyListSubtext()}</div>
            </div>
          ) : (
            groups.map(g => (
              <SupermarketCard
                key={g.supermarket.id}
                group={g}
                customIconMap={customIconMap}
                onToggle={onToggle}
                onMenu={setMenuItem}
              />
            ))
          )}
        </main>

        <footer
          className="fixed left-0 right-0 bottom-0 mx-auto max-w-mobile px-4 py-3 space-y-2"
          style={{
            background: 'linear-gradient(to top, #f3ede4 60%, transparent)',
          }}
        >
          {checkedCount > 0 && (
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="w-full h-11 rounded-xl text-sm font-medium active:opacity-80"
              style={{ background: 'rgba(255,252,247,0.7)', color: '#7a6e5d', border: '1px solid rgba(215,205,188,0.4)' }}
            >
              {getFinishShoppingText(checkedCount)}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90"
            style={{ background: '#7ca982' }}
          >
            + 添加物品
          </button>
        </footer>

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

        <MoreMenu
          open={showMore}
          onClose={() => setShowMore(false)}
          onCopyShareText={onCopyShareText}
          onManageMarkets={() => nav('/manage-markets')}
          onSettings={() => nav('/settings')}
          onHistory={() => nav('/history')}
          onImport={() => setShowImport(true)}
        />

        <ImportSheet
          open={showImport}
          supermarkets={list.supermarkets}
          onClose={() => setShowImport(false)}
          onImport={onImport}
        />

        <ConfirmModal
          open={showFinishConfirm}
          title="完成采购"
          message={`将清掉 ${checkedCount} 项已购物品，未勾选的保留。`}
          confirmText="清掉已购"
          cancelText="再想想"
          onConfirm={onFinishShopping}
          onCancel={() => setShowFinishConfirm(false)}
        />

        <UndoToast
          toast={undoToast.toast}
          onUndo={undoToast.undo}
          onDismiss={undoToast.dismiss}
        />
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
