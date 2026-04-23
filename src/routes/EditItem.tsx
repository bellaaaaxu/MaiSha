import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { updateItem, deleteItem } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { CATEGORY_DEFS, FALLBACK_CATEGORY, FALLBACK_CATEGORY_EMOJI } from '@/utils/constants';
import type { Item, CategoryKey } from '@/types/item';

export default function EditItem() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { nav(-1); return; }
    supabase.from('items').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) { alert('加载失败'); nav(-1); return; }
        setItem(data as Item);
        setLoading(false);
      });
  }, [id, nav]);

  if (loading || !item || !list) {
    return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;
  }

  const categoryOptions = [
    ...CATEGORY_DEFS.map(d => ({ key: d.key, emoji: d.emoji })),
    { key: FALLBACK_CATEGORY, emoji: FALLBACK_CATEGORY_EMOJI }
  ];

  const save = async () => {
    if (!item.name.trim()) { alert('名称不能为空'); return; }
    const cat = categoryOptions.find(c => c.key === item.category)!;
    try {
      await updateItem(item.id, {
        name: item.name.trim(),
        note: item.note,
        quantity: item.quantity,
        supermarket: item.supermarket,
        category: item.category,
        category_emoji: cat.emoji
      });
      nav(-1);
    } catch {
      alert('保存失败');
    }
  };

  const remove = async () => {
    if (!confirm(`删除 "${item.name}"？`)) return;
    try { await deleteItem(item.id); nav(-1); } catch { alert('删除失败'); }
  };

  return (
    <div className="p-4 min-h-screen">
      <header className="flex items-center mb-4">
        <button onClick={() => nav(-1)} className="text-primary text-sm mr-3">‹ 返回</button>
        <div className="text-base font-semibold">编辑物品</div>
      </header>

      <Field label="名称">
        <input
          className="w-full px-4 py-3 bg-white rounded-xl text-sm outline-none"
          value={item.name}
          onChange={(e) => setItem({ ...item, name: e.target.value })}
        />
      </Field>

      <Field label="备注（品牌/规格）">
        <input
          className="w-full px-4 py-3 bg-white rounded-xl text-sm outline-none"
          placeholder="如 伊利 1L"
          value={item.note}
          onChange={(e) => setItem({ ...item, note: e.target.value })}
        />
      </Field>

      <Field label="数量">
        <input
          className="w-full px-4 py-3 bg-white rounded-xl text-sm outline-none"
          placeholder="如 2瓶 / 2斤"
          value={item.quantity}
          onChange={(e) => setItem({ ...item, quantity: e.target.value })}
        />
      </Field>

      <Field label="超市">
        <select
          className="w-full px-4 py-3 bg-white rounded-xl text-sm outline-none"
          value={item.supermarket}
          onChange={(e) => setItem({ ...item, supermarket: e.target.value })}
        >
          {list.supermarkets.map(s => (
            <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
          ))}
        </select>
      </Field>

      <Field label="品类">
        <select
          className="w-full px-4 py-3 bg-white rounded-xl text-sm outline-none"
          value={item.category}
          onChange={(e) => {
            const key = e.target.value as CategoryKey;
            const emoji = categoryOptions.find(c => c.key === key)?.emoji ?? '📦';
            setItem({ ...item, category: key, category_emoji: emoji });
          }}
        >
          {categoryOptions.map(c => (
            <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>
          ))}
        </select>
      </Field>

      <div className="flex gap-3 mt-8">
        <button
          onClick={remove}
          className="flex-1 h-12 bg-red-50 text-danger rounded-xl font-semibold text-sm"
        >
          删除
        </button>
        <button
          onClick={save}
          className="flex-1 h-12 bg-primary text-white rounded-xl font-semibold text-sm"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-gray-400 font-semibold mb-2">{label}</div>
      {children}
    </div>
  );
}
