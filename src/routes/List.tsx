import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { SupermarketCard } from '@/components/SupermarketCard';
import { AddSheet } from '@/components/AddSheet';
import { ItemMenu } from '@/components/ItemMenu';
import { groupItemsByMarketAndCategory } from '@/utils/group-items';
import { addItem, updateItem, deleteItem, clearChecked } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import type { Item, NewItemInput } from '@/types/item';

export default function ListRoute() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const joinListId = params.get('list');

  const { uid } = useAuth();
  const { list, loading: listLoading, error: listErr } = useList(uid, joinListId);
  const { items, loading: itemsLoading } = useItems(list?.id ?? null);

  const [showAdd, setShowAdd] = useState(false);
  const [menuItem, setMenuItem] = useState<Item | null>(null);

  const groups = useMemo(
    () => (list ? groupItemsByMarketAndCategory(items, list.supermarkets) : []),
    [items, list]
  );
  const uncheckedCount = items.filter(i => !i.checked).length;
  const checkedCount = items.length - uncheckedCount;

  if (listLoading || itemsLoading) {
    return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;
  }
  if (listErr) {
    return <div className="p-8 text-center text-danger text-sm">{listErr}</div>;
  }
  if (!list || !uid) return null;

  const onToggle = async (item: Item) => {
    try {
      await updateItem(item.id, {
        checked: !item.checked,
        checked_at: !item.checked ? new Date().toISOString() : null
      });
    } catch {
      alert('操作失败');
    }
  };

  const onAdd = async (input: NewItemInput) => {
    try {
      await addItem(list.id, uid, input);
      recordItemUsage(uid, {
        name: input.name,
        note: input.note ?? '',
        supermarket: input.supermarket ?? 'none',
        category_emoji: input.category_emoji ?? '📦'
      });
      setShowAdd(false);
    } catch {
      alert('添加失败');
    }
  };

  const onShareMenu = async () => {
    const url = `${location.origin}/list?list=${list.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('邀请链接已复制！\n' + url);
    } catch {
      prompt('复制这个链接：', url);
    }
  };

  const onFinishShopping = async () => {
    if (!confirm(`完成采购？将清掉 ${checkedCount} 项已购物品`)) return;
    try {
      await clearChecked(list.id);
      // Realtime 会推送 DELETE 事件，UI 自动刷新
    } catch {
      alert('操作失败');
    }
  };

  const onMore = async () => {
    const choice = prompt('操作：\n1 = 管理超市\n2 = 设置', '');
    if (choice === '1') {
      nav('/manage-markets');
    } else if (choice === '2') {
      nav('/settings');
    }
  };

  const onMenuDelete = async (item: Item) => {
    if (!confirm(`删除 "${item.name}"？`)) return;
    try { await deleteItem(item.id); } catch { alert('删除失败'); }
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

  return (
    <div className="min-h-screen pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center">
        <div className="flex-1">
          <div className="text-lg font-semibold">买啥</div>
          <div className="text-xs text-gray-500">
            共享 · {uncheckedCount}项待买
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onShareMenu} className="text-xl" aria-label="分享">📤</button>
          <button onClick={onMore} className="text-xl" aria-label="更多">⋯</button>
        </div>
      </header>

      <main className="p-4">
        {groups.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-6xl mb-4">🛒</div>
            <div className="text-base text-gray-500">清单是空的</div>
            <div className="text-xs text-gray-400 mt-1">点底部 + 添加第一项</div>
          </div>
        ) : (
          groups.map(g => (
            <SupermarketCard
              key={g.supermarket.id}
              group={g}
              onToggle={onToggle}
              onMenu={setMenuItem}
            />
          ))
        )}
      </main>

      <footer className="fixed left-0 right-0 bottom-0 mx-auto max-w-mobile px-4 py-3 bg-gradient-to-t from-white via-white/95 to-transparent space-y-2">
        {checkedCount > 0 && (
          <button
            onClick={onFinishShopping}
            className="w-full h-11 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium active:bg-gray-200"
          >
            🛍️ 完成采购，清掉 {checkedCount} 项
          </button>
        )}
        <button
          onClick={() => setShowAdd(true)}
          className="w-full h-12 bg-primary active:bg-primary-dark text-white rounded-xl font-semibold text-base"
        >
          + 添加物品
        </button>
      </footer>

      <AddSheet
        open={showAdd}
        uid={uid}
        onClose={() => setShowAdd(false)}
        onSubmit={onAdd}
      />

      <ItemMenu
        item={menuItem}
        onClose={() => setMenuItem(null)}
        onEdit={onMenuEdit}
        onDelete={onMenuDelete}
        onDuplicate={onMenuDuplicate}
      />
    </div>
  );
}
