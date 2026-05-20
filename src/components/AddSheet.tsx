import { useEffect, useState, useMemo, useCallback } from 'react';
import { getTopFrequentItems, type FrequentItem } from '@/utils/frequent-items';
import { matchCategory } from '@/utils/category-matcher';
import { UNIQUE_ICON_ITEMS, type IconItem } from '@/utils/icon-registry';
import type { NewItemInput, CategoryKey } from '@/types/item';
import type { Supermarket } from '@/types/supermarket';
import { IconPickerPanel } from '@/components/IconPickerPanel';
import { AiPreviewModal } from '@/components/AiPreviewModal';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { cropToSquare, processImageForUpload, sanitizeItemName } from '@/utils/image-utils';
import { uploadCustomIcon, generateIcon, findExistingIcon, getRemainingCredits } from '@/lib/custom-icons';

interface Props {
  open: boolean;
  uid: string;
  listId: string;
  supermarkets: Supermarket[];
  customIconMap: Map<string, string>;
  onClose: () => void;
  onAdd: (input: NewItemInput) => Promise<string>;
  onRemove: (itemId: string) => Promise<void>;
  onIconsChanged: () => void | Promise<void>;
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

export function AddSheet({ open, uid, listId, supermarkets, customIconMap, onClose, onAdd, onRemove, onIconsChanged }: Props) {
  const [value, setValue] = useState('');
  const [frequent, setFrequent] = useState<FrequentItem[]>([]);
  const [addedItems, setAddedItems] = useState<Map<string, string>>(new Map());
  const [animating, setAnimating] = useState<Map<string, 'pop' | 'remove'>>(new Map());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());
  const [selectedMarket, setSelectedMarket] = useState<string>('none');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');
  const [pendingCategory, setPendingCategory] = useState<CategoryKey>('其他');
  const [remainingCredits, setRemainingCredits] = useState(5);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [showStylize, setShowStylize] = useState(false);

  useEffect(() => {
    if (open) {
      setFrequent(getTopFrequentItems(uid, 12));
      setAddedItems(new Map());
      setAnimating(new Map());
      setBusy(new Set());
      setIconErrors(new Set());
      setSelectedMarket('none');
      getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
    }
  }, [open, uid]);

  // Reset custom-icon state when sheet closes
  useEffect(() => {
    if (!open) {
      setValue('');
      setShowIconPicker(false);
      setPendingItemName('');
      setAiModalOpen(false);
      setAiLoading(false);
      setAiError(null);
      setAiImageUrl(null);
      setUploadedPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setShowStylize(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return UNIQUE_ICON_ITEMS;
    return UNIQUE_ICON_ITEMS.filter(i =>
      i.name.includes(q) || i.aliases?.some(a => a.includes(q))
    );
  }, [value]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const triggerAnim = useCallback((name: string, type: 'pop' | 'remove') => {
    setAnimating(prev => new Map(prev).set(name, type));
    setTimeout(() => setAnimating(prev => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    }), 400);
  }, []);

  const toggleItem = useCallback(async (name: string, input: NewItemInput) => {
    if (busy.has(name)) return;
    setBusy(prev => new Set(prev).add(name));
    try {
      const existingId = addedItems.get(name);
      if (existingId) {
        triggerAnim(name, 'remove');
        await onRemove(existingId);
        setAddedItems(prev => { const next = new Map(prev); next.delete(name); return next; });
      } else {
        triggerAnim(name, 'pop');
        const id = await onAdd(input);
        setAddedItems(prev => new Map(prev).set(name, id));
      }
    } catch { /* parent handles error */ }
    setBusy(prev => { const next = new Set(prev); next.delete(name); return next; });
  }, [addedItems, busy, onAdd, onRemove, triggerAnim]);

  const submitTyped = () => {
    const name = value.trim();
    if (!name) return;
    const m = matchCategory(name);

    // Check if preset or custom icon exists
    const hasPreset = UNIQUE_ICON_ITEMS.some(
      i => i.name === name || i.aliases?.includes(name)
    );
    const hasCustom = customIconMap.has(name);

    if (!hasPreset && !hasCustom) {
      // Show icon picker panel
      setPendingItemName(name);
      setPendingCategory(m.category as CategoryKey);
      setShowIconPicker(true);
      return;
    }

    // Has icon — add directly
    toggleItem(name, {
      name, note: '', quantity: '',
      supermarket: selectedMarket,
      category: m.category as CategoryKey,
      category_emoji: m.emoji
    });
    setValue('');
  };

  const handleSkipIcon = () => {
    if (!pendingItemName) return; // guard
    const m = matchCategory(pendingItemName);
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setShowIconPicker(false);
    setPendingItemName('');
    setValue('');
  };

  const handleUploadPhoto = () => {
    const itemName = sanitizeItemName(pendingItemName); // capture and sanitize
    if (!itemName) return; // refuse to proceed with empty name
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      try {
        const cropped = await cropToSquare(file);
        const compressed = await processImageForUpload(cropped);

        // Note: findExistingIcon is also called inside uploadCustomIcon for storage cleanup.
        // We do this query separately here to show the confirmation prompt before any work.
        const existing = await findExistingIcon(listId, itemName);
        if (existing) {
          const confirmReplace = window.confirm(`「${itemName}」已有自定义图标，要替换吗？`);
          if (!confirmReplace) return;
        }

        await uploadCustomIcon(listId, itemName, compressed, 'upload', uid);
        await onIconsChanged();

        // Show preview with stylize option
        setUploadedPreviewUrl(URL.createObjectURL(compressed));
        setShowStylize(true);
        setAiModalOpen(true);
        setShowIconPicker(false);
      } catch (err) {
        console.error('Upload failed:', err);
        alert('上传失败，请重试');
      }
    };
    input.click();
  };

  const handleAiGenerate = async (referenceImageBase64?: string) => {
    setAiModalOpen(true);
    setShowIconPicker(false);
    setAiLoading(true);
    setAiError(null);
    setAiImageUrl(null);
    setShowStylize(false);

    try {
      const sanitized = sanitizeItemName(pendingItemName);
      const result = await generateIcon(sanitized, listId, referenceImageBase64);
      setAiImageUrl(result.image_url);
      setRemainingCredits(result.remaining_today);
    } catch (err: any) {
      if (err.code === 'RATE_LIMIT') {
        setAiError('今日生成额度已用完');
        setRemainingCredits(0);
      } else {
        setAiError('生成失败，请稍后重试');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiAccept = async () => {
    if (!pendingItemName) return; // guard
    // Icon already saved by Edge Function, just add the item
    const m = matchCategory(pendingItemName);
    await onIconsChanged();
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setAiModalOpen(false);
    setPendingItemName('');
    setValue('');
  };

  const handleUploadAccept = () => {
    if (!pendingItemName) return; // guard
    // Photo already uploaded, just add the item
    const m = matchCategory(pendingItemName);
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
      category: pendingCategory,
      category_emoji: m.emoji
    });
    setAiModalOpen(false);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
    setShowStylize(false);
    setPendingItemName('');
    setValue('');
  };

  const handleStylize = async () => {
    if (!uploadedPreviewUrl) return;
    try {
      const response = await fetch(uploadedPreviewUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
        setUploadedPreviewUrl(null);
        setShowStylize(false);
        handleAiGenerate(base64);
      };
      reader.readAsDataURL(blob);
    } catch {
      alert('转换失败，请重试');
    }
  };

  const handleAiSkip = () => {
    handleSkipIcon();
    setAiModalOpen(false);
  };

  const submitIcon = (item: IconItem) => {
    const m = matchCategory(item.name);
    toggleItem(item.name, {
      name: item.name,
      note: '', quantity: '',
      supermarket: selectedMarket,
      category: (item.category || m.category) as CategoryKey,
      category_emoji: m.emoji
    });
  };

  const submitFrequent = (f: FrequentItem) => {
    const m = matchCategory(f.name);
    toggleItem(f.name, {
      name: f.name,
      note: f.note,
      quantity: '',
      supermarket: selectedMarket,
      category: m.category as CategoryKey,
      category_emoji: f.category_emoji || m.emoji
    });
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
        <div className="flex justify-between items-center px-5 pb-2">
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

        {/* supermarket selector */}
        <div className="px-5 pb-2">
          <div className="text-[10px] font-medium tracking-wider mb-1.5" style={{ color: '#a0937e' }}>
            添加到
          </div>
          <div className="flex flex-wrap gap-1.5">
            {supermarkets.map(m => {
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
                  <span>{m.emoji}</span>
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
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
                  const added = addedItems.has(f.name);
                  const anim = animating.get(f.name);
                  const iconItem = UNIQUE_ICON_ITEMS.find(i => i.name === f.name);
                  const showIcon = iconItem && !iconErrors.has(iconItem.icon);
                  return (
                    <button
                      key={`${f.name}|${f.note}|${f.supermarket}`}
                      onClick={() => submitFrequent(f)}
                      className="flex flex-col items-center rounded-2xl p-2 transition-all"
                      style={{
                        background: added ? 'rgba(124,169,130,0.15)' : 'rgba(255,252,247,0.45)',
                        border: added ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                        animation: anim === 'pop' ? 'addPop 0.4s ease' : anim === 'remove' ? 'addShake 0.3s ease' : 'none',
                      }}
                    >
                      <div className="w-12 h-12 mb-1 flex items-center justify-center relative">
                        {showIcon ? (
                          <img
                            src={`/icons/${iconItem!.icon}.png`}
                            alt={f.name}
                            className="w-full h-full object-contain rounded-lg"
                            style={{ mixBlendMode: 'multiply', opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(iconItem!.icon))}
                          />
                        ) : (
                          <div style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                            <WatercolorFallback name={f.name} category="其他" size={40} />
                          </div>
                        )}
                        {added && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'checkPop 0.3s ease' }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#7ca982' }}>
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium truncate w-full text-center" style={{ color: added ? '#7ca982' : '#5a4e3c' }}>
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
                  const added = addedItems.has(item.name);
                  const anim = animating.get(item.name);
                  const hasIconFile = !iconErrors.has(item.icon);
                  return (
                    <button
                      key={item.name}
                      onClick={() => submitIcon(item)}
                      className="flex flex-col items-center rounded-[18px] p-2.5 transition-all"
                      style={{
                        background: added ? 'rgba(124,169,130,0.15)' : 'rgba(255,252,247,0.45)',
                        border: added ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                        animation: anim === 'pop' ? 'addPop 0.4s ease' : anim === 'remove' ? 'addShake 0.3s ease' : 'none',
                      }}
                    >
                      <div className="w-[68px] h-[68px] mb-1.5 flex items-center justify-center relative">
                        {hasIconFile ? (
                          <img
                            src={`/icons/${item.icon}.png`}
                            alt={item.name}
                            className="w-full h-full object-contain rounded-xl"
                            style={{ mixBlendMode: 'multiply', opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(item.icon))}
                          />
                        ) : (
                          <div style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                            <WatercolorFallback name={item.name} category={item.category} size={56} />
                          </div>
                        )}
                        {added && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'checkPop 0.3s ease' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#7ca982' }}>
                              <span className="text-white text-sm font-bold">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: added ? '#7ca982' : '#5a4e3c' }}
                      >
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* custom icon picker */}
          {showIconPicker && pendingItemName && (
            <IconPickerPanel
              itemName={pendingItemName}
              category={pendingCategory}
              remainingCredits={remainingCredits}
              onUpload={handleUploadPhoto}
              onAiGenerate={() => handleAiGenerate()}
              onSkip={handleSkipIcon}
            />
          )}

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

      {/* AI preview modal */}
      <AiPreviewModal
        open={aiModalOpen}
        itemName={pendingItemName}
        imageUrl={uploadedPreviewUrl ?? aiImageUrl}
        loading={aiLoading}
        error={aiError}
        remainingCredits={remainingCredits}
        onAccept={uploadedPreviewUrl ? handleUploadAccept : handleAiAccept}
        onRetry={() => handleAiGenerate()}
        onSkip={handleAiSkip}
        showStylize={showStylize}
        onStylize={handleStylize}
      />
    </div>
  );
}
