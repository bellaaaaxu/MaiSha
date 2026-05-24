import { useState } from 'react';
import { savePurchaseHistory } from '@/lib/purchase-history';
import type { Item } from '@/types/item';
import type { HistoryItemSnapshot } from '@/types/purchase-history';

interface Props {
  open: boolean;
  supermarketName: string;
  totalCount: number;
  boughtCount: number;
  missedCount: number;
  listId: string;
  supermarketId: string;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}

const CELEBRATIONS = [
  { emoji: '🎉', text: '辛苦啦，今天的菜齐了！' },
  { emoji: '🌟', text: '太棒了，全部搞定！' },
  { emoji: '🛍️', text: '完美采购，一样不少！' },
  { emoji: '✨', text: '效率满分，回家做饭咯！' },
];

export function ShoppingEndModal({
  open, supermarketName, totalCount: _totalCount, boughtCount: _boughtCount, missedCount,
  listId, supermarketId, items, onClose, onDone,
}: Props) {
  const [saving, setSaving] = useState(false);
  const allDone = missedCount === 0;
  const celebration = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];

  if (!open) return null;

  const saveAndClose = async (_clearMissed: boolean) => {
    setSaving(true);
    try {
      const snapshot: HistoryItemSnapshot[] = items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        note: i.note,
        category: i.category,
        category_emoji: i.category_emoji,
        checked: i.checked,
      }));
      await savePurchaseHistory(listId, supermarketId, supermarketName, snapshot);
    } catch {
      alert('保存失败，请重试');
      setSaving(false);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div
        className="mx-6 w-full max-w-sm rounded-3xl p-7 text-center"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        {allDone ? (
          <>
            <div className="text-5xl mb-3">{celebration.emoji}</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物完成</h3>
            <p className="text-sm mb-6" style={{ color: '#a0937e' }}>
              {celebration.text}
            </p>
            <button
              onClick={() => saveAndClose(false)}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#7ca982' }}
            >
              {saving ? '保存中…' : '返回清单'}
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🛍️</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物结束</h3>
            <p className="text-sm mb-6" style={{ color: '#a0937e' }}>
              还有 {missedCount} 件没买到
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => saveAndClose(false)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: '#7ca982' }}
              >
                {saving ? '保存中…' : '保留下次买'}
              </button>
              <button
                onClick={() => saveAndClose(true)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-medium text-sm"
                style={{ background: '#f5f0ea', color: '#5a4e3c' }}
              >
                全部清除
              </button>
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-4 text-xs"
          style={{ color: '#ccc' }}
        >
          继续购物
        </button>
      </div>
    </div>
  );
}
