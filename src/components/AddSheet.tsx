import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTopFrequentItems, type FrequentItem } from '@/utils/frequent-items';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { calculateFrequentlyBought } from '@/utils/frequently-bought';
import { UNIQUE_ICON_ITEMS, type IconItem } from '@/utils/icon-registry';
import type { NewItemInput } from '@/types/item';
import type { Store } from '@/types/store';
import { IconPickerPanel } from '@/components/IconPickerPanel';
import { AiPreviewModal } from '@/components/AiPreviewModal';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { cropToSquare, processImageForUpload, sanitizeItemName } from '@/utils/image-utils';
import { uploadCustomIcon, generateIcon, findExistingIcon, getRemainingCredits } from '@/lib/custom-icons';
import { useLongPress } from '@/hooks/useLongPress';
import { IconPreviewOverlay } from '@/components/IconPreviewOverlay';
import { UNDELETABLE_STORE_ID } from '@/utils/constants';

interface Props {
  open: boolean;
  uid: string;
  listId: string;
  supermarkets: Store[];
  customIconMap: Map<string, string>;
  onClose: () => void;
  onAdd: (input: NewItemInput) => Promise<string>;
  onRemove: (itemId: string) => Promise<void>;
  onIconsChanged: () => void | Promise<void>;
  onOpenImport?: () => void;
}

interface IconButtonProps {
  iconUrl: string | null;
  itemName: string;
  category: string;
  added: boolean;
  anim: 'pop' | 'remove' | undefined;
  onTap: () => void;
  onLongPress: (preview: { url: string; name: string; subtitle: string }) => void;
  size: 'frequent' | 'grid';
  children: React.ReactNode;
}

function IconButton({ iconUrl, itemName, category, added, anim, onTap, onLongPress, size, children }: IconButtonProps) {
  const { handlers, isPressing, isLongPressed } = useLongPress(() => {
    onLongPress({
      url: iconUrl ?? '',
      name: itemName,
      subtitle: iconUrl ? `${category} · 预设图标` : `${category} · 水彩兜底`,
    });
  });

  const isFrequent = size === 'frequent';

  return (
    <button
      {...handlers}
      onClick={(e) => {
        if (isLongPressed) {
          e.preventDefault();
          return;
        }
        onTap();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col items-center transition-all ${
        isFrequent ? 'rounded-2xl p-2' : 'rounded-[18px] p-2.5'
      }`}
      style={{
        background: added ? 'rgba(124,169,130,0.15)' : 'rgba(255,252,247,0.45)',
        border: added ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
        transform: isPressing ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 200ms ease, background 200ms ease',
        animation: anim === 'pop' ? 'addPop 0.4s ease' : anim === 'remove' ? 'addShake 0.3s ease' : 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {children}
      <span
        className={`font-medium ${isFrequent ? 'text-[10px] truncate w-full text-center' : 'text-[11px]'}`}
        style={{ color: added ? '#7ca982' : '#5a4e3c' }}
      >
        {itemName}
      </span>
    </button>
  );
}

export function AddSheet({ open, uid, listId, supermarkets, customIconMap, onClose, onAdd, onRemove, onIconsChanged, onOpenImport }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [frequent, setFrequent] = useState<FrequentItem[]>([]);
  const [addedItems, setAddedItems] = useState<Map<string, string>>(new Map());
  const [animating, setAnimating] = useState<Map<string, 'pop' | 'remove'>>(new Map());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());
  const [selectedMarket, setSelectedMarket] = useState<string>('none');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');
  const [remainingCredits, setRemainingCredits] = useState(5);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [showStylize, setShowStylize] = useState(false);
  const [previewIcon, setPreviewIcon] = useState<{ url: string; name: string; subtitle: string } | null>(null);
  const [showPreviewHint, setShowPreviewHint] = useState(false);

  const { history } = usePurchaseHistory(listId);
  const frequentlyBought = useMemo(
    () => calculateFrequentlyBought(history, 8),
    [history]
  );

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

  // First-time long-press hint
  useEffect(() => {
    if (open && !localStorage.getItem('maisha:preview-hint-seen')) {
      setShowPreviewHint(true);
      const t = window.setTimeout(() => {
        setShowPreviewHint(false);
        localStorage.setItem('maisha:preview-hint-seen', '1');
      }, 4000);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Dismiss preview on global pointer release
  useEffect(() => {
    if (!previewIcon) return;
    const handler = () => setPreviewIcon(null);
    window.addEventListener('pointerup', handler);
    window.addEventListener('pointercancel', handler);
    return () => {
      window.removeEventListener('pointerup', handler);
      window.removeEventListener('pointercancel', handler);
    };
  }, [previewIcon]);

  // "未指定店铺" always pinned to the end of the supermarket selector
  const sortedSupermarkets = useMemo(() => [
    ...supermarkets.filter(s => s.id !== UNDELETABLE_STORE_ID),
    ...supermarkets.filter(s => s.id === UNDELETABLE_STORE_ID),
  ], [supermarkets]);

  const allIcons = useMemo<IconItem[]>(() => {
    const customNames = new Set(customIconMap.keys());
    // Custom icons as synthetic IconItems
    const customIcons: IconItem[] = Array.from(customIconMap.entries()).map(([name, url]) => ({
      name,
      icon: '',         // unused when iconUrl is set
      iconUrl: url,
      category: '其他',
    }));
    // Preset icons, excluding any whose names are overridden by custom
    const presets = UNIQUE_ICON_ITEMS.filter(i =>
      !customNames.has(i.name) && !i.aliases?.some(a => customNames.has(a))
    );
    return [...customIcons, ...presets];
  }, [customIconMap]);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return allIcons;
    return allIcons.filter(i =>
      i.name.includes(q) || i.aliases?.some(a => a.includes(q))
    );
  }, [value, allIcons]);

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

    // Check if preset or custom icon exists
    const hasPreset = UNIQUE_ICON_ITEMS.some(
      i => i.name === name || i.aliases?.includes(name)
    );
    const hasCustom = customIconMap.has(name);

    if (!hasPreset && !hasCustom) {
      // Show icon picker panel
      setPendingItemName(name);
      setShowIconPicker(true);
      return;
    }

    // Has icon — add directly
    toggleItem(name, {
      name, note: '', quantity: '',
      supermarket: selectedMarket,
    });
    setValue('');
  };

  const handleSkipIcon = () => {
    if (!pendingItemName) return; // guard
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
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
    await onIconsChanged();
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
    });
    setAiModalOpen(false);
    setPendingItemName('');
    setValue('');
  };

  const handleUploadAccept = () => {
    if (!pendingItemName) return; // guard
    // Photo already uploaded, just add the item
    toggleItem(pendingItemName, {
      name: pendingItemName, note: '', quantity: '',
      supermarket: selectedMarket,
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
    toggleItem(item.name, {
      name: item.name,
      note: '', quantity: '',
      supermarket: selectedMarket,
    });
  };

  const submitFrequent = (f: FrequentItem) => {
    toggleItem(f.name, {
      name: f.name,
      note: f.note,
      quantity: '',
      supermarket: selectedMarket,
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
            {t('addSheet.title')}
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded-lg active:opacity-60"
            style={{ color: '#7ca982', fontWeight: 600 }}
          >
            {t('common.done')}
          </button>
        </div>

        {/* supermarket selector */}
        <div className="px-5 pb-2">
          <div className="text-[10px] font-medium tracking-wider mb-1.5" style={{ color: '#a0937e' }}>
            {t('addSheet.store')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedSupermarkets.map(m => {
              const active = selectedMarket === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMarket(m.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--ink-faint)'}`,
                    background: active ? 'rgba(212, 131, 107, 0.1)' : 'none',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: active ? 'var(--accent)' : 'var(--ink-light)',
                    cursor: 'pointer',
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* search */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center rounded-full px-4 py-2.5"
              style={{
                background: 'rgba(255,252,247,0.6)',
                border: '1px solid rgba(215,205,188,0.4)',
              }}
            >
              <span className="text-sm mr-2" style={{ color: '#c4b49a' }}>🔍</span>
              <input
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: '#5a4e3c' }}
                placeholder={t('addSheet.namePlaceholder')}
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
                  {t('addSheet.add')}
                </button>
              )}
            </div>
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full active:opacity-70"
                style={{
                  background: 'rgba(255,252,247,0.6)',
                  border: '1px solid rgba(215,205,188,0.4)',
                }}
                aria-label="粘贴导入"
              >
                📋
              </button>
            )}
          </div>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* frequently bought (history-based) */}
          {!value && frequentlyBought.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full" style={{ background: '#c97b63' }} />
                  <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
                    {t('addSheet.frequent')}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    for (const item of frequentlyBought) {
                      if (!addedItems.has(item.name)) {
                        await onAdd({
                          name: item.name,
                          supermarket: selectedMarket,
                        });
                      }
                    }
                  }}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(124,169,130,0.1)', color: '#7ca982' }}
                >
                  全部加上
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {frequentlyBought.map(item => {
                  const added = addedItems.has(item.name);
                  const anim = animating.get(item.name);
                  const customUrl = customIconMap.get(item.name);
                  const presetItem = !customUrl ? UNIQUE_ICON_ITEMS.find(i => i.name === item.name || i.aliases?.includes(item.name)) : null;
                  const freqErrorKey = customUrl ? `custom:${item.name}` : presetItem?.icon ?? '';
                  const iconSrc = customUrl ?? (presetItem ? `/icons/${presetItem.icon}.webp` : null);
                  const showIcon = !!iconSrc && !iconErrors.has(freqErrorKey);
                  const iconUrl = showIcon ? iconSrc : null;
                  return (
                    <IconButton
                      key={`fb-${item.name}`}
                      iconUrl={iconUrl}
                      itemName={item.name}
                      category="其他"
                      added={added}
                      anim={anim}
                      size="frequent"
                      onTap={() => {
                        toggleItem(item.name, {
                          name: item.name,
                          note: '',
                          quantity: '',
                          supermarket: selectedMarket,
                        });
                      }}
                      onLongPress={setPreviewIcon}
                    >
                      <div className="w-12 h-12 mb-1 flex items-center justify-center relative">
                        {showIcon ? (
                          <img
                            src={iconUrl!}
                            alt={item.name}
                            draggable={false}
                            className="w-full h-full object-contain rounded-lg pointer-events-none"
                            style={{ mixBlendMode: 'multiply', opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(freqErrorKey))}
                          />
                        ) : (
                          <div style={{ opacity: added ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                            <WatercolorFallback name={item.name} category="其他" size={40} />
                          </div>
                        )}
                        {added && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'checkPop 0.3s ease' }}>
                            <span style={{ color: '#7ca982', fontSize: 20 }}>✓</span>
                          </div>
                        )}
                      </div>
                    </IconButton>
                  );
                })}
              </div>
            </div>
          )}

          {/* frequent items (local usage history) */}
          {!value && frequent.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="w-1.5 h-4 rounded-full" style={{ background: '#c4b49a' }} />
                <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
                  {t('addSheet.frequent')}
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {frequent.map(f => {
                  const added = addedItems.has(f.name);
                  const anim = animating.get(f.name);
                  // Check custom first, then preset
                  const customUrl = customIconMap.get(f.name);
                  const presetItem = !customUrl ? UNIQUE_ICON_ITEMS.find(i => i.name === f.name || i.aliases?.includes(f.name)) : null;
                  const freqErrorKey = customUrl ? `custom:${f.name}` : presetItem?.icon ?? '';
                  const iconSrc = customUrl ?? (presetItem ? `/icons/${presetItem.icon}.webp` : null);
                  const showIcon = !!iconSrc && !iconErrors.has(freqErrorKey);
                  const iconUrl = showIcon ? iconSrc : null;
                  return (
                    <IconButton
                      key={`${f.name}|${f.note}|${f.supermarket}`}
                      iconUrl={iconUrl}
                      itemName={f.name}
                      category="其他"
                      added={added}
                      anim={anim}
                      size="frequent"
                      onTap={() => submitFrequent(f)}
                      onLongPress={setPreviewIcon}
                    >
                      <div className="w-12 h-12 mb-1 flex items-center justify-center relative">
                        {showIcon ? (
                          <img
                            src={iconUrl!}
                            alt={f.name}
                            draggable={false}
                            className="w-full h-full object-contain rounded-lg pointer-events-none"
                            style={{ mixBlendMode: 'multiply', opacity: added ? 0.45 : 1, transition: 'opacity 0.3s', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(freqErrorKey))}
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
                    </IconButton>
                  );
                })}
              </div>
            </div>
          )}

          {/* icon grid (flat, no category sections) */}
          {filtered.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2.5">
                {filtered.map((item) => {
                  const added = addedItems.has(item.name);
                  const anim = animating.get(item.name);
                  // Custom icons use iconUrl directly; preset icons build path from filename stem.
                  // Error tracking key is the icon stem (preset) or name (custom) to distinguish.
                  const errorKey = item.iconUrl ? `custom:${item.name}` : item.icon;
                  const hasIconFile = !iconErrors.has(errorKey);
                  const iconUrl = item.iconUrl ?? (hasIconFile ? `/icons/${item.icon}.webp` : null);
                  return (
                    <IconButton
                      key={item.name}
                      iconUrl={iconUrl}
                      itemName={item.name}
                      category={item.category}
                      added={added}
                      anim={anim}
                      size="grid"
                      onTap={() => submitIcon(item)}
                      onLongPress={setPreviewIcon}
                    >
                      <div className="w-[68px] h-[68px] mb-1.5 flex items-center justify-center relative">
                        {hasIconFile ? (
                          <img
                            src={iconUrl!}
                            alt={item.name}
                            draggable={false}
                            className="w-full h-full object-contain rounded-xl pointer-events-none"
                            style={{ mixBlendMode: 'multiply', opacity: added ? 0.45 : 1, transition: 'opacity 0.3s', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                            onError={() => setIconErrors(prev => new Set(prev).add(errorKey))}
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
                    </IconButton>
                  );
                })}
              </div>
            </div>
          )}

          {/* custom icon picker */}
          {showIconPicker && pendingItemName && (
            <IconPickerPanel
              itemName={pendingItemName}
              category="其他"
              remainingCredits={remainingCredits}
              onUpload={handleUploadPhoto}
              onAiGenerate={() => handleAiGenerate()}
              onSkip={handleSkipIcon}
            />
          )}

          {/* no results */}
          {value && filtered.length === 0 && (
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

        {/* First-time long-press hint */}
        {showPreviewHint && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-full text-xs whitespace-nowrap"
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              animation: 'fadeInOut 4s ease',
            }}
          >
            💡 长按图标可预览大图
          </div>
        )}
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

      {/* Long-press icon preview overlay */}
      <IconPreviewOverlay
        iconUrl={previewIcon?.url || null}
        itemName={previewIcon?.name || ''}
        subtitle={previewIcon?.subtitle}
      />
    </div>
  );
}
