import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { fetchPurchaseHistoryById } from '@/lib/purchase-history';
import { addItem } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import { formatAmount, getOrDetectCurrency } from '@/utils/currency';
import type { PurchaseHistory } from '@/types/purchase-history';
import type { HistoryItemSnapshot } from '@/types/purchase-history';

export default function PurchaseHistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const [record, setRecord] = useState<PurchaseHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    fetchPurchaseHistoryById(id).then(r => { setRecord(r); setLoading(false); });
  }, [id]);

  if (loading || !record) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf6f0', color: '#a0937e' }}>加载中…</div>;
  }

  const items = record.items_snapshot as HistoryItemSnapshot[];
  const allSelected = selected.size === items.length;

  const toggleItem = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((_, i) => i)));
  };

  const reAdd = async () => {
    if (!list || !uid || selected.size === 0) return;
    setAdding(true);
    try {
      for (const idx of selected) {
        const item = items[idx];
        await addItem(list.id, uid, {
          name: item.name,
          note: item.note,
          quantity: item.quantity,
          category: item.category,
          category_emoji: item.category_emoji,
          supermarket: record.supermarket_id,
        });
        recordItemUsage(uid, {
          name: item.name,
          note: item.note,
          supermarket: record.supermarket_id,
          category_emoji: item.category_emoji,
        });
      }
      alert(`已添加 ${selected.size} 样到清单`);
      nav('/list');
    } catch {
      alert('添加失败');
    } finally {
      setAdding(false);
    }
  };

  const dateStr = new Date(record.completed_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen pb-24 page-enter" style={{ background: '#faf6f0' }}>
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10"
        style={{ background: 'rgba(250,246,240,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
        <div className="flex-1 text-center">
          <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>{record.supermarket_name}</div>
          <div className="text-xs" style={{ color: '#a0937e' }}>
            {dateStr}
            {record.amount != null && (
              <span style={{ color: '#c97b63' }}> · {formatAmount(record.amount, getOrDetectCurrency())}</span>
            )}
          </div>
        </div>
        <button onClick={selectAll} className="text-xs" style={{ color: '#7ca982' }}>
          {allSelected ? '取消全选' : '全选'}
        </button>
      </header>

      <main className="p-4 space-y-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => toggleItem(i)}
            className="w-full flex items-center gap-3 rounded-xl p-3 active:scale-[0.98] transition-transform"
            style={{
              background: selected.has(i) ? 'rgba(124,169,130,0.08)' : 'rgba(255,252,247,0.5)',
              border: selected.has(i) ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.3)',
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{
              background: selected.has(i) ? '#7ca982' : 'transparent',
              border: selected.has(i) ? 'none' : '2px solid #d5cbbe',
            }}>
              {selected.has(i) && <span className="text-white text-xs">✓</span>}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm" style={{ color: item.checked ? '#5a4e3c' : '#c4b49a' }}>
                {item.category_emoji} {item.name}
                {item.quantity && <span className="text-xs ml-1" style={{ color: '#c97b63' }}>×{item.quantity}</span>}
              </div>
              {item.note && <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>{item.note}</div>}
            </div>
            {!item.checked && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#fff3e0', color: '#c97b63' }}>没买到</span>
            )}
          </button>
        ))}
      </main>

      {selected.size > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 mx-auto max-w-mobile px-4 py-3" style={{ background: 'linear-gradient(to top, #f3ede4 60%, transparent)' }}>
          <button
            onClick={reAdd}
            disabled={adding}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
            style={{ background: '#7ca982' }}
          >
            {adding ? '添加中…' : `再买一次 · ${selected.size} 样`}
          </button>
        </footer>
      )}
    </div>
  );
}
