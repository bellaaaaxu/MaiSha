import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [newEmoji, setNewEmoji] = useState('');

  useEffect(() => {
    if (list) setItems(JSON.parse(JSON.stringify(list.supermarkets)));
  }, [list]);

  if (!list) return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;

  const rename = (idx: number, val: string) => {
    const next = items.slice();
    next[idx] = { ...next[idx], name: val };
    setItems(next);
  };

  const remove = (idx: number) => {
    if (items[idx].id === UNDELETABLE_SUPERMARKET_ID) {
      alert('"未分类"不可删');
      return;
    }
    const next = items.slice();
    next.splice(idx, 1);
    setItems(next);
  };

  const add = () => {
    if (!newName.trim()) return;
    setItems([...items, {
      id: 'sm_' + Date.now().toString(36),
      name: newName.trim(),
      emoji: newEmoji.trim() || '🏪'
    }]);
    setNewName('');
    setNewEmoji('');
  };

  const save = async () => {
    try {
      await updateListSupermarkets(list.id, items);
      alert('已保存');
      nav(-1);
    } catch {
      alert('保存失败');
    }
  };

  return (
    <div className="p-4 min-h-screen pb-24">
      <header className="flex items-center mb-4">
        <button onClick={() => nav(-1)} className="text-primary text-sm mr-3">‹ 返回</button>
        <div className="text-base font-semibold">管理超市</div>
      </header>

      {items.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 mb-1.5">
          <span className="text-xl">{s.emoji}</span>
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            value={s.name}
            onChange={(e) => rename(idx, e.target.value)}
            disabled={s.id === UNDELETABLE_SUPERMARKET_ID}
          />
          {s.id === UNDELETABLE_SUPERMARKET_ID ? (
            <span className="text-xs text-gray-400">系统</span>
          ) : (
            <button onClick={() => remove(idx)} className="text-xs text-danger">删除</button>
          )}
        </div>
      ))}

      <div className="flex gap-2 mt-4 mb-6">
        <input
          className="flex-1 px-3 py-2.5 bg-white rounded-xl text-sm outline-none"
          placeholder="新超市名（如：Walmart）"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="w-20 px-2 py-2.5 bg-white rounded-xl text-sm text-center outline-none"
          placeholder="emoji"
          maxLength={2}
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
        />
        <button
          onClick={add}
          className="px-4 bg-green-50 text-primary-dark rounded-xl text-sm font-medium"
        >
          添加
        </button>
      </div>

      <button
        onClick={save}
        className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm"
      >
        保存
      </button>
    </div>
  );
}
