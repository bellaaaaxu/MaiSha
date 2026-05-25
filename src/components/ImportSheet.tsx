import { useState, useMemo } from 'react';
import { parseImportText, parsedToInputs, type ParsedItem } from '@/utils/parse-import-text';
import type { Store } from '@/types/store';
import { UNDELETABLE_SUPERMARKET_ID } from '@/utils/constants';

interface Props {
  open: boolean;
  supermarkets: Store[];
  onClose: () => void;
  onImport: (items: ReturnType<typeof parsedToInputs>) => void;
}

export function ImportSheet({ open, supermarkets, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string>('none');

  const parsed = useMemo<ParsedItem[]>(() => parseImportText(text), [text]);

  const sortedSupermarkets = useMemo(() => [
    ...supermarkets.filter(s => s.id !== UNDELETABLE_SUPERMARKET_ID),
    ...supermarkets.filter(s => s.id === UNDELETABLE_SUPERMARKET_ID),
  ], [supermarkets]);

  const handleImport = () => {
    if (parsed.length === 0) return;
    onImport(parsedToInputs(parsed, selectedMarket));
    setText('');
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl pb-8 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          maxHeight: '80vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#d5cbbe' }} />
        </div>

        {/* header */}
        <div className="flex justify-between items-center px-5 pb-3">
          <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>
            📥 粘贴导入
          </div>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 rounded-lg active:opacity-60"
            style={{ color: '#a0937e' }}
          >
            取消
          </button>
        </div>

        {/* supermarket selector */}
        <div className="px-5 pb-3">
          <div className="text-[10px] font-medium tracking-wider mb-1.5" style={{ color: '#a0937e' }}>
            添加到
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedSupermarkets.map(m => {
              const active = selectedMarket === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMarket(m.id)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
                  style={{
                    background: active ? '#7ca982' : 'rgba(255,252,247,0.6)',
                    color: active ? '#fff' : '#5a4e3c',
                    border: active ? '1px solid #7ca982' : '1px solid rgba(215,205,188,0.4)',
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* textarea */}
        <div className="px-5 pb-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full rounded-xl p-3 text-sm outline-none resize-none"
            style={{
              background: 'rgba(255,252,247,0.6)',
              border: '1px solid rgba(215,205,188,0.4)',
              color: '#5a4e3c',
              minHeight: 120,
            }}
            placeholder={`粘贴你的购物清单，每行一个商品\n例如：\n牛奶 2盒\n鸡蛋\n- 西红柿 ×3\n面包 1袋`}
          />
        </div>

        {/* preview */}
        {parsed.length > 0 && (
          <div className="px-5 pb-3 flex-1 overflow-y-auto" style={{ maxHeight: 200 }}>
            <div className="text-[10px] font-medium tracking-wider mb-1.5" style={{ color: '#a0937e' }}>
              预览（{parsed.length} 项）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parsed.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: 'rgba(124,169,130,0.12)',
                    color: '#5a4e3c',
                    border: '1px solid rgba(124,169,130,0.2)',
                  }}
                >
                  <span>{p.category_emoji}</span>
                  <span>{p.name}</span>
                  {p.quantity && (
                    <span style={{ color: '#a0937e' }}>×{p.quantity}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* import button */}
        <div className="px-5 pt-2">
          <button
            onClick={handleImport}
            disabled={parsed.length === 0}
            className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90 disabled:opacity-40"
            style={{ background: '#7ca982' }}
          >
            {parsed.length > 0 ? `导入 ${parsed.length} 项` : '粘贴文本后导入'}
          </button>
        </div>
      </div>
    </div>
  );
}
