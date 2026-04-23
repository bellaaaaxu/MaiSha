import { useEffect, useState } from 'react';
import { Chip } from './Chip';
import { getTopFrequentItems, getRecentItems, type FrequentItem } from '@/utils/frequent-items';
import { matchCategory } from '@/utils/category-matcher';
import type { NewItemInput, CategoryKey } from '@/types/item';

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
  onSubmit: (input: NewItemInput) => void;
}

export function AddSheet({ open, uid, onClose, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [frequent, setFrequent] = useState<FrequentItem[]>([]);
  const [recent, setRecent] = useState<FrequentItem[]>([]);

  useEffect(() => {
    if (open) {
      setFrequent(getTopFrequentItems(uid, 6));
      setRecent(getRecentItems(uid, 5));
    } else {
      setValue('');
    }
  }, [open, uid]);

  const submitTyped = () => {
    const name = value.trim();
    if (!name) return;
    const m = matchCategory(name);
    onSubmit({
      name, note: '', quantity: '',
      supermarket: 'none',
      category: m.category as CategoryKey,
      category_emoji: m.emoji
    });
    setValue('');
  };

  const submitChip = (f: FrequentItem) => {
    const m = matchCategory(f.name);
    onSubmit({
      name: f.name,
      note: f.note,
      quantity: '',
      supermarket: f.supermarket,
      category: m.category as CategoryKey,
      category_emoji: f.category_emoji || m.emoji
    });
  };

  const chipLabel = (f: FrequentItem) => f.note ? `${f.name} ${f.note}` : f.name;

  return (
    <div
      className={`fixed inset-0 z-40 transition-colors ${
        open ? 'bg-black/40 pointer-events-auto' : 'bg-black/0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl p-4 pb-8 transition-transform ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-3">
          <div className="text-base font-semibold">添加物品</div>
          <button onClick={onClose} className="text-sm text-gray-500">关闭</button>
        </div>

        <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-3">
          <input
            className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
            placeholder="搜索或输入，如 '西红柿 2斤'"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
            enterKeyHint="done"
          />
          {value && (
            <button onClick={submitTyped} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">
              确定
            </button>
          )}
        </div>

        {frequent.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 font-semibold mb-1.5">常买</div>
            <div className="flex flex-wrap">
              {frequent.map(f => (
                <Chip
                  key={`${f.name}|${f.note}|${f.supermarket}`}
                  emoji={f.category_emoji}
                  label={chipLabel(f)}
                  variant="frequent"
                  onClick={() => submitChip(f)}
                />
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 font-semibold mb-1.5">最近添加</div>
            <div className="flex flex-wrap">
              {recent.map(f => (
                <Chip
                  key={`r-${f.name}|${f.note}|${f.supermarket}`}
                  emoji={f.category_emoji}
                  label={chipLabel(f)}
                  variant="recent"
                  onClick={() => submitChip(f)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
