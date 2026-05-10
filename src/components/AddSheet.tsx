import { useEffect, useState, useMemo } from 'react';
import { getTopFrequentItems, type FrequentItem } from '@/utils/frequent-items';
import { matchCategory } from '@/utils/category-matcher';
import { UNIQUE_ICON_ITEMS, type IconItem } from '@/utils/icon-registry';
import type { NewItemInput, CategoryKey } from '@/types/item';

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
  onSubmit: (input: NewItemInput) => void;
}

const CATEGORY_ORDER = ['蔬菜', '肉蛋', '乳制品', '主食', '调料', '日用', '烘焙', '饮料'];
const CATEGORY_COLORS: Record<string, string> = {
  '蔬菜': '#7ca982',
  '肉蛋': '#c97b63',
  '乳制品': '#d4a96a',
  '主食': '#8b9dc3',
  '调料': '#b08d57',
  '日用': '#9b8ec0',
  '烘焙': '#c9886d',
  '饮料': '#6a9fb5',
};

function groupByCategory(items: IconItem[]) {
  const groups: { category: string; items: IconItem[] }[] = [];
  const map = new Map<string, IconItem[]>();
  for (const item of items) {
    const arr = map.get(item.category) ?? [];
    arr.push(item);
    map.set(item.category, arr);
  }
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat);
    if (items?.length) groups.push({ category: cat, items });
  }
  for (const [cat, items] of map) {
    if (!CATEGORY_ORDER.includes(cat)) groups.push({ category: cat, items });
  }
  return groups;
}

export function AddSheet({ open, uid, onClose, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [frequent, setFrequent] = useState<FrequentItem[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setFrequent(getTopFrequentItems(uid, 12));
      setAddedNames(new Set());
      setIconErrors(new Set());
    } else {
      setValue('');
    }
  }, [open, uid]);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return UNIQUE_ICON_ITEMS;
    return UNIQUE_ICON_ITEMS.filter(i =>
      i.name.includes(q) || i.aliases?.some(a => a.includes(q))
    );
  }, [value]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

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

  const submitIcon = (item: IconItem) => {
    if (addedNames.has(item.name)) return;
    const m = matchCategory(item.name);
    onSubmit({
      name: item.name,
      note: '', quantity: '',
      supermarket: 'none',
      category: (item.category || m.category) as CategoryKey,
      category_emoji: m.emoji
    });
    setAddedNames(prev => new Set(prev).add(item.name));
  };

  const submitFrequent = (f: FrequentItem) => {
    if (addedNames.has(f.name)) return;
    const m = matchCategory(f.name);
    onSubmit({
      name: f.name,
      note: f.note,
      quantity: '',
      supermarket: f.supermarket,
      category: m.category as CategoryKey,
      category_emoji: f.category_emoji || m.emoji
    });
    setAddedNames(prev => new Set(prev).add(f.name));
  };


  return (
    <div
      className={`fixed inset-0 z-40 transition-colors ${
        open ? 'bg-black/30 pointer-events-auto' : 'bg-black/0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`absolute left-0 right-0 bottom-0 rounded-t-3xl transition-transform ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#d5cbbe' }} />
        </div>

        {/* header */}
        <div className="flex justify-between items-center px-5 pb-3">
          <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>
            添加物品
          </div>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded-lg active:opacity-60"
            style={{ color: '#a0937e' }}
          >
            关闭
          </button>
        </div>

        {/* search */}
        <div className="px-5 pb-3">
          <div
            className="flex items-center rounded-full px-4 py-2.5"
            style={{
              background: 'rgba(255,252,247,0.6)',
              border: '1px solid rgba(215,205,188,0.4)',
            }}
          >
            <span className="text-sm mr-2" style={{ color: '#c4b49a' }}>🔍</span>
            <input
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: '#5a4e3c' }}
              placeholder="搜索或输入商品名..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
              enterKeyHint="done"
            />
            {value && (
              <button
                onClick={submitTyped}
                className="px-3 py-1 rounded-full text-xs text-white font-medium active:opacity-80"
                style={{ background: '#7ca982' }}
              >
                添加
              </button>
            )}
          </div>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* frequent items */}
          {!value && frequent.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="w-1.5 h-4 rounded-full" style={{ background: '#c4b49a' }} />
                <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
                  常买
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {frequent.map(f => {
                  const added = addedNames.has(f.name);
                  const iconItem = UNIQUE_ICON_ITEMS.find(i => i.name === f.name);
                  const showIcon = iconItem && !iconErrors.has(iconItem.icon);
                  return (
                    <button
                      key={`${f.name}|${f.note}|${f.supermarket}`}
                      onClick={() => submitFrequent(f)}
                      className="flex flex-col items-center rounded-2xl p-2 transition-all active:scale-95"
                      style={{
                        background: added ? 'rgba(124,169,130,0.15)' : 'rgba(255,252,247,0.45)',
                        border: added ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                      }}
                    >
                      <div className="w-12 h-12 mb-1 flex items-center justify-center">
                        {showIcon ? (
                          <img
                            src={`/icons/${iconItem!.icon}.png`}
                            alt={f.name}
                            className="w-full h-full object-contain rounded-lg"
                            style={{ mixBlendMode: 'multiply' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(iconItem!.icon))}
                          />
                        ) : (
                          <span className="text-2xl">{f.category_emoji}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium truncate w-full text-center" style={{ color: '#5a4e3c' }}>
                        {f.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* icon grid by category */}
          {groups.map((group) => (
            <div key={group.category} className="mb-4">
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div
                  className="w-1.5 h-4 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[group.category] || '#999' }}
                />
                <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
                  {group.category}
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map((item) => {
                  const added = addedNames.has(item.name);
                  const hasIconFile = !iconErrors.has(item.icon);
                  return (
                    <button
                      key={item.name}
                      onClick={() => submitIcon(item)}
                      className="flex flex-col items-center rounded-[18px] p-2.5 transition-all active:scale-95"
                      style={{
                        background: added ? 'rgba(124,169,130,0.15)' : 'rgba(255,252,247,0.45)',
                        border: added ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                      }}
                    >
                      <div className="w-[68px] h-[68px] mb-1.5 flex items-center justify-center">
                        {hasIconFile ? (
                          <img
                            src={`/icons/${item.icon}.png`}
                            alt={item.name}
                            className="w-full h-full object-contain rounded-xl"
                            style={{ mixBlendMode: 'multiply' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(item.icon))}
                          />
                        ) : (
                          <span className="text-3xl">📦</span>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: added ? '#7ca982' : '#5a4e3c' }}
                      >
                        {added ? `✓ ${item.name}` : item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* no results */}
          {value && groups.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: '#a0937e' }}>
                没有匹配的图标
              </p>
              <p className="text-xs mt-1" style={{ color: '#c4b49a' }}>
                按回车或点"添加"直接创建
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
