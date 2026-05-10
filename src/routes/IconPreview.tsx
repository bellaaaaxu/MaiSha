import { useState } from 'react';
import { AddSheet } from '@/components/AddSheet';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getIconPath } from '@/utils/icon-registry';
import type { NewItemInput } from '@/types/item';

const MOCK_LIST = [
  { id: '1', name: '西红柿', note: '2斤', quantity: '', category_emoji: '🥬', checked: false },
  { id: '2', name: '鸡蛋', note: '', quantity: '1盒', category_emoji: '🥩', checked: false },
  { id: '3', name: '五花肉', note: '', quantity: '500g', category_emoji: '🥩', checked: false },
  { id: '4', name: '牛奶', note: '', quantity: '2盒', category_emoji: '🥛', checked: false },
  { id: '5', name: '洋葱', note: '紫皮', quantity: '', category_emoji: '🥬', checked: true },
  { id: '6', name: '大米', note: '', quantity: '5kg', category_emoji: '🍚', checked: true },
];

function MockItemRow({ item, onToggle }: { item: typeof MOCK_LIST[0]; onToggle: () => void }) {
  const iconPath = getIconPath(item.name);
  const hasIcon = !!iconPath;

  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-2xl p-2.5 mb-2 transition-all cursor-pointer active:scale-[0.98]`}
    >
      <div
        className={`shrink-0 flex items-center justify-center rounded-xl ${
          item.checked ? 'opacity-40 grayscale' : ''
        }`}
        style={{
          width: hasIcon ? 56 : 44,
          height: hasIcon ? 56 : 44,
          background: 'rgba(255,252,247,0.5)',
          border: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        {hasIcon ? (
          <img
            src={iconPath}
            alt=""
            className="w-full h-full object-contain rounded-xl p-1"
            style={{ mixBlendMode: 'multiply' }}
          />
        ) : (
          <span className="text-xl">{item.category_emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium ${item.checked ? 'line-through' : ''}`}
          style={{ color: item.checked ? '#b8a992' : '#5a4e3c' }}
        >
          {item.name}
        </div>
        {(item.note || item.quantity) && (
          <div className={`text-xs mt-0.5 ${item.checked ? 'line-through' : ''}`} style={{ color: '#a0937e' }}>
            {[item.note, item.quantity && `× ${item.quantity}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      <div className="w-7 h-7 flex items-center justify-center shrink-0">
        {item.checked ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#7ca982' }}>
            <span className="text-white text-xs">✓</span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: '#d5cbbe' }} />
        )}
      </div>

      <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ color: '#c4b49a' }}>⋮</div>
    </div>
  );
}

export default function IconPreview() {
  const [showAdd, setShowAdd] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [items, setItems] = useState(MOCK_LIST);

  const toggle = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  return (
    <div
      className="min-h-screen pb-36"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      {/* header */}
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10"
        style={{
          background: 'rgba(250,246,240,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        <div className="flex-1">
          <div className="text-lg font-semibold" style={{ color: '#5a4e3c' }}>买啥</div>
          <div className="text-xs" style={{ color: '#a0937e' }}>
            共享 · {unchecked.length}项待买
          </div>
        </div>
        <div className="flex gap-4">
          <button className="text-xl active:opacity-60">📤</button>
          <button className="text-xl active:opacity-60" style={{ color: '#a0937e' }}>⋯</button>
        </div>
      </header>

      {/* list */}
      <main className="p-4">
        {/* supermarket card */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: 'rgba(255,252,247,0.5)',
            border: '1px solid rgba(215,205,188,0.35)',
          }}
        >
          <div className="flex items-center gap-2 pb-2 mb-2" style={{ borderBottom: '1px solid rgba(215,205,188,0.3)' }}>
            <span className="text-base">🥬</span>
            <span className="text-base font-semibold" style={{ color: '#5a4e3c' }}>T&T 大统华</span>
            <span className="text-xs ml-1" style={{ color: '#a0937e' }}>· {items.length}项</span>
            <span className="ml-auto text-xs" style={{ color: '#c4b49a' }}>▾</span>
          </div>

          {/* unchecked items */}
          {unchecked.map((item) => (
            <MockItemRow
              key={item.name}
              item={item}
              onToggle={() => toggle(items.indexOf(item))}
            />
          ))}

          {/* checked items */}
          {checked.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-3 mb-2 px-1">
                <div className="flex-1 h-px" style={{ background: 'rgba(215,205,188,0.4)' }} />
                <span className="text-[10px]" style={{ color: '#c4b49a' }}>已购 {checked.length}项</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(215,205,188,0.4)' }} />
              </div>
              {checked.map((item) => (
                <MockItemRow
                  key={item.name}
                  item={item}
                  onToggle={() => toggle(items.indexOf(item))}
                />
              ))}
            </>
          )}
        </div>
      </main>

      {/* footer */}
      <footer
        className="fixed left-0 right-0 bottom-0 mx-auto max-w-mobile px-4 py-3 space-y-2"
        style={{ background: 'linear-gradient(to top, #f3ede4 60%, transparent)' }}
      >
        {checked.length > 0 && (
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="w-full h-11 rounded-xl text-sm font-medium active:opacity-80"
            style={{ background: 'rgba(255,252,247,0.7)', color: '#7a6e5d', border: '1px solid rgba(215,205,188,0.4)' }}
          >
            🛍️ 完成采购，清掉 {checked.length} 项
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
        uid="preview-user"
        supermarkets={[
          { id: 'tnt', name: 'T&T 大统华', emoji: '🥬' },
          { id: 'yc', name: '元初', emoji: '🛒' },
          { id: 'costco', name: 'Costco', emoji: '🏬' },
          { id: 'wholefoods', name: 'Whole Foods', emoji: '🥗' },
          { id: 'none', name: '未分类', emoji: '❓' },
        ]}
        onClose={() => setShowAdd(false)}
        onAdd={async (input: NewItemInput) => {
          const id = crypto.randomUUID();
          setItems(prev => [...prev, { name: input.name, note: input.note || '', quantity: input.quantity || '', category_emoji: input.category_emoji || '📦', checked: false, id }]);
          return id;
        }}
        onRemove={async (itemId: string) => {
          setItems(prev => prev.filter(i => i.id !== itemId));
        }}
      />

      <ConfirmModal
        open={showFinishConfirm}
        title="完成采购"
        message={`将清掉 ${checked.length} 项已购物品，未勾选的保留。`}
        confirmText="清掉已购"
        cancelText="再想想"
        onConfirm={() => {
          setItems(prev => prev.filter(i => !i.checked));
          setShowFinishConfirm(false);
        }}
        onCancel={() => setShowFinishConfirm(false)}
      />
    </div>
  );
}
