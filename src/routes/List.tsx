import { useEffect, useMemo, useState } from 'react';
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
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { UndoToast } from '@/components/UndoToast';
import { ImportSheet } from '@/components/ImportSheet';
import { RecoveryCodeCard } from '@/components/RecoveryCodeCard';
import { NoticeModal } from '@/components/NoticeModal';
import PurchaseHistory from '@/routes/PurchaseHistory';
import { groupItemsByStore } from '@/utils/group-items';
import { relocalizeExampleItems } from '@/utils/example-items';
import { addItem, updateItem, deleteItem, clearAllItems } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import { buildInviteText, buildCopiedNotice } from '@/utils/invite-text';
import { generateShareText } from '@/utils/share-text';
import { track } from '@/lib/analytics';
import type { Item, NewItemInput } from '@/types/item';
import { ListSwitcherIcon } from '@/components/ListSwitcherIcon';
import { PaperPlaneIcon } from '@/components/PaperPlaneIcon';
import { RefreshIcon } from '@/components/RefreshIcon';

export default function ListRoute() {
  const [params] = useSearchParams();
  const joinListId = params.get('list');
  const nav = useNavigate();

  const { uid } = useAuth();
  const { list, loading: listLoading, error: listErr } = useList(uid, joinListId);
  const { items, loading: itemsLoading, optimisticAdd, optimisticRemove, optimisticUpdate } = useItems(list?.id ?? null);
  const { iconMap: customIconMap, refresh: refreshIcons } = useCustomIcons(list?.id ?? null);

  const [showAdd, setShowAdd] = useState(false);
  const [preselectedStore, setPreselectedStore] = useState<string | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const [draggingItem, setDraggingItem] = useState<Item | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
  const { t } = useTranslation();
  const undoToast = useUndoToast();
  const [notice, setNotice] = useState<{ title?: string; message: string } | null>(null);

  // 邀请链接打开即记录（ua_env 自动区分微信/其他）；清单解析成功≈加入或回访，
  // 分析侧按 (uid, list_id) 去重后即真实加入数
  useEffect(() => {
    if (joinListId) track('share_link_open', { listId: joinListId });
  }, [joinListId]);
  useEffect(() => {
    if (joinListId && list?.id === joinListId) track('list_join', { listId: list.id });
  }, [joinListId, list?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } })
  );

  // 拖拽中显示所有超市（含空），方便放入空超市
  const groups = useMemo(
    () => (list ? groupItemsByStore(items, list.supermarkets, !!draggingItem) : []),
    [items, list, draggingItem]
  );

  const existingItemNames = useMemo(
    () => new Set(items.map(i => i.name)),
    [items]
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
    optimisticAdd(item);
    track('add_item', { listId: list.id, props: { source: 'sheet', count: 1 } });
    recordItemUsage(uid, {
      name: input.name,
      note: input.note ?? '',
      supermarket: input.supermarket ?? 'none',
      category_emoji: '📦',
    });
    return item.id;
  };

  const onRemoveAdded = async (itemId: string) => {
    optimisticRemove(itemId);
    await deleteItem(itemId);
  };

  const onShareMenu = async () => {
    const text = buildInviteText(t, list.id, list.short_code, location.origin);
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ message: buildCopiedNotice(t, list.short_code) });
    } catch {
      setNotice({ title: t('listActions.shareCopy'), message: text });
    }
  };

  const onCopyText = async () => {
    const text = generateShareText(items, list.supermarkets);
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ message: t('settings.textCopied') });
    } catch {
      setNotice({ title: t('listActions.shareCopy'), message: text });
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
      track('add_item', { listId: list.id, props: { source: 'import', count } });
      undoToast.show(`已导入 ${count} 项`, () => {});
    }
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
          padding: '16px 20px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t('settings.title')}
            style={{
              fontSize: 22, color: 'var(--ink-light)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 4, lineHeight: 1, marginLeft: -4,
            }}
          >≡</button>
          <span style={{
            fontFamily: 'var(--font-wordmark)',
            fontWeight: 700,
            fontSize: 28,
            color: 'var(--ink)',
            letterSpacing: 2,
            flex: 1,
            paddingLeft: 4,
          }}>
            {t('app.title')}
          </span>
          <button
            onClick={() => window.location.reload()}
            aria-label={t('header.refresh')}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(232,174,151,.13)', border: '1px solid rgba(232,174,151,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 4,
            }}
          >
            <RefreshIcon size={22} />
          </button>
          <button
            onClick={() => nav('/my-lists')}
            aria-label={t('myLists.title')}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(232,174,151,.13)', border: '1px solid rgba(232,174,151,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 4,
            }}
          >
            <ListSwitcherIcon size={22} />
          </button>
          <button
            onClick={onShareMenu}
            aria-label={t('header.joinList')}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(232,174,151,.13)', border: '1px solid rgba(232,174,151,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 4,
            }}
          >
            <PaperPlaneIcon size={22} />
          </button>
        </div>

        {/* Subtitle: washi tape style showing which list is current */}
        <div style={{ padding: '0 20px 10px', paddingLeft: 40 }}>
          <button
            onClick={() => nav('/my-lists')}
            aria-label={t('myLists.title')}
            style={{
              display: 'inline-block',
              fontSize: 12,
              color: 'var(--ink)',
              padding: '3px 10px',
              background: 'rgba(178,213,205,.45)',
              border: 'none',
              borderLeft: '2px solid rgba(124,169,130,.5)',
              borderRight: '2px solid rgba(124,169,130,.3)',
              borderRadius: 0,
              transform: 'rotate(-0.5deg)',
              transformOrigin: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ color: 'var(--ink-light)', fontWeight: 400 }}>{t('list.currentPrefix')}</span>
            {' '}
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{list.name}</span>
          </button>
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
            <RecoveryCodeCard itemCount={items.length} />
            {groups.length === 0 ? (
              <div style={{ padding: '96px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                <div style={{ fontSize: 16, color: 'var(--ink-faint)' }}>{t('list.emptyTitle')}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ink-faint)' }}>{t('list.emptySubtitle')}</div>
                <button
                  onClick={() => nav('/join?mode=recover')}
                  style={{
                    marginTop: 24,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--ink-light)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                    padding: 8,
                  }}
                >
                  {t('recoveryCard.entryList')}
                </button>
              </div>
            ) : (
              groups.map((group, i) => (
                <StoreCard
                  key={group.store.id}
                  group={group}
                  customIconMap={customIconMap}
                  supermarkets={list.supermarkets}
                  onUpdateNote={async (itemId, note) => {
                    optimisticUpdate(itemId, { note });
                    await updateItem(itemId, { note });
                  }}
                  onUpdateStore={async (itemId, storeId) => {
                    optimisticUpdate(itemId, { supermarket: storeId });
                    await updateItem(itemId, { supermarket: storeId });
                  }}
                  onDeleteItem={async (itemId) => {
                    optimisticRemove(itemId);
                    await deleteItem(itemId);
                  }}
                  onAddItem={(storeId) => {
                    setPreselectedStore(storeId);
                    setShowAdd(true);
                  }}
                  colorIndex={i}
                  dragging={!!draggingItem}
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
          existingItemNames={existingItemNames}
          preselectedStore={preselectedStore}
          onClose={() => { setShowAdd(false); setPreselectedStore(undefined); }}
          onAdd={onAdd}
          onRemove={onRemoveAdded}
          onIconsChanged={refreshIcons}
          onOpenImport={() => { setShowAdd(false); setShowImport(true); }}
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

        <SettingsDrawer
          open={showSettings}
          itemCount={items.length}
          onClose={() => setShowSettings(false)}
          onClearList={async () => {
            await clearAllItems(list.id);
          }}
          onOpenImport={() => setShowImport(true)}
          onCopyText={onCopyText}
          onLanguageChanged={(lang) => {
            // 未被用户改动的示例商品跟随新语言重写（用户数据绝不触碰）
            for (const { id, patch } of relocalizeExampleItems(items, lang)) {
              optimisticUpdate(id, patch);
              // 非关键，失败保持原文；但要留痕——后台标签页 token 过期时
              // 写入会静默丢失（乐观更新已上屏，刷新即回退），别让它无迹可查
              updateItem(id, patch).catch(err => console.warn('[relocalize] 写入失败', id, err));
            }
          }}
        />

        <NoticeModal
          open={!!notice}
          title={notice?.title}
          message={notice?.message ?? ''}
          closeText={t('common.ok')}
          onClose={() => setNotice(null)}
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
