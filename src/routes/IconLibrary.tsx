import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { NewIconSheet } from '@/components/NewIconSheet';
import { deleteCustomIcon, getPublicIconUrl, generateIcon, type CustomIcon } from '@/lib/custom-icons';
import { formatRelativeDate, formatSourceLabel } from '@/utils/date-format';
import { UNIQUE_ICON_ITEMS, type IconItem } from '@/utils/icon-registry';

export default function IconLibrary() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list, loading: listLoading } = useList(uid, null);
  const { icons, refresh, loading: iconsLoading } = useMyLibrary(list?.account_id ?? null);

  const [showNewSheet, setShowNewSheet] = useState(false);
  const [newSheetInitialName, setNewSheetInitialName] = useState<string | undefined>(undefined);
  const [menuIcon, setMenuIcon] = useState<CustomIcon | null>(null);
  const [previewIcon, setPreviewIcon] = useState<CustomIcon | null>(null);
  const [presetMenuItem, setPresetMenuItem] = useState<IconItem | null>(null);
  const [presetPreview, setPresetPreview] = useState<IconItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (listLoading || iconsLoading) {
    return <div className="p-8 text-center text-gray-500 text-sm">加载中…</div>;
  }
  if (!list || !uid) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: '#a0937e' }}>
        找不到清单
      </div>
    );
  }

  const sortedIcons = [...icons].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Hide preset icons that have been overridden by a custom icon
  const customNames = new Set(icons.map(i => i.name));
  const visiblePresets = UNIQUE_ICON_ITEMS.filter(
    p => !customNames.has(p.name) && !p.aliases?.some(a => customNames.has(a))
  );

  const onRegenerate = async (icon: CustomIcon) => {
    setMenuIcon(null);
    if (!confirm(`重新生成「${icon.name}」的 AI 图标？会消耗 1 次今日额度。`)) return;
    setBusyId(icon.id);
    try {
      await generateIcon(icon.name, list.id);
      await refresh();
    } catch (err: any) {
      if (err.code === 'RATE_LIMIT') {
        alert('今日 AI 生成额度已用完');
      } else {
        alert('生成失败，请重试');
      }
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (icon: CustomIcon) => {
    setMenuIcon(null);
    if (!confirm(`删除「${icon.name}」的图标？删除后会显示水彩兜底，物品本身不会被删除。`)) return;
    setBusyId(icon.id);
    try {
      await deleteCustomIcon(icon);
      await refresh();
    } catch {
      alert('删除失败');
    } finally {
      setBusyId(null);
    }
  };

  const onReplacePreset = (item: IconItem) => {
    setPresetMenuItem(null);
    setNewSheetInitialName(item.name);
    setShowNewSheet(true);
  };

  const openNewSheetFresh = () => {
    setNewSheetInitialName(undefined);
    setShowNewSheet(true);
  };

  return (
    <div
      className="min-h-screen pb-8"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      {/* Header */}
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10 gap-3"
        style={{
          background: 'rgba(250,246,240,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        <button
          onClick={() => nav(-1)}
          className="text-xl active:opacity-60"
          style={{ color: '#a0937e' }}
          aria-label="返回"
        >
          ←
        </button>
        <div className="flex-1 text-base font-semibold" style={{ color: '#5a4e3c' }}>
          图标库
        </div>
        <button
          onClick={openNewSheetFresh}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white active:opacity-80"
          style={{ background: '#7ca982' }}
        >
          + 新增
        </button>
      </header>

      <main className="p-4">
        {/* Custom icons section */}
        {sortedIcons.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <div className="w-1.5 h-4 rounded-full" style={{ background: '#7ca982' }} />
              <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
                自定义 · {sortedIcons.length}
              </span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
            </div>
            {sortedIcons.map(icon => (
              <button
                key={icon.id}
                onClick={() => setPreviewIcon(icon)}
                disabled={busyId === icon.id}
                className="w-full flex items-center gap-3 p-2.5 mb-2 rounded-2xl active:opacity-80 transition-all"
                style={{
                  background: 'rgba(255,252,247,0.6)',
                  border: '1px solid rgba(215,205,188,0.35)',
                  opacity: busyId === icon.id ? 0.5 : 1,
                }}
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-xl"
                  style={{
                    width: 56, height: 56,
                    background: 'rgba(255,252,247,0.5)',
                    border: '1px solid rgba(215,205,188,0.3)',
                  }}
                >
                  <img
                    src={getPublicIconUrl(icon.image_path)}
                    alt={icon.name}
                    draggable={false}
                    className="w-full h-full object-contain rounded-xl p-1 pointer-events-none"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium" style={{ color: '#5a4e3c' }}>
                    {icon.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>
                    {formatSourceLabel(icon.source)} · {formatRelativeDate(icon.created_at)}
                  </div>
                </div>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setMenuIcon(icon); }}
                  className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg active:opacity-50"
                  style={{ color: '#c4b49a' }}
                  aria-label="更多操作"
                >
                  ⋮
                </button>
              </button>
            ))}
          </section>
        )}

        {/* Preset icons section */}
        <section>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div className="w-1.5 h-4 rounded-full" style={{ background: '#c4b49a' }} />
            <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
              预设 · {visiblePresets.length}
            </span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
          </div>
          {visiblePresets.map(item => (
            <button
              key={item.icon}
              onClick={() => setPresetPreview(item)}
              className="w-full flex items-center gap-3 p-2.5 mb-2 rounded-2xl active:opacity-80 transition-all"
              style={{
                background: 'rgba(255,252,247,0.4)',
                border: '1px solid rgba(215,205,188,0.25)',
              }}
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-xl"
                style={{
                  width: 56, height: 56,
                  background: 'rgba(255,252,247,0.5)',
                  border: '1px solid rgba(215,205,188,0.3)',
                }}
              >
                <img
                  src={`/icons/${item.icon}.webp`}
                  alt={item.name}
                  draggable={false}
                  className="w-full h-full object-contain rounded-xl p-1 pointer-events-none"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium" style={{ color: '#5a4e3c' }}>
                  {item.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>
                  {item.category} · 预设
                </div>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setPresetMenuItem(item); }}
                className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg active:opacity-50"
                style={{ color: '#c4b49a' }}
                aria-label="更多操作"
              >
                ⋮
              </button>
            </button>
          ))}
        </section>
      </main>

      {/* Custom row ⋮ menu */}
      {menuIcon && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={() => setMenuIcon(null)}
        >
          <div
            className="w-full bg-white rounded-t-2xl pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-3 text-center text-sm text-gray-500 border-b border-gray-100">
              {menuIcon.name}
            </div>
            <button
              onClick={() => onRegenerate(menuIcon)}
              className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
            >
              🔄 重新生成（AI）
            </button>
            <button
              onClick={() => onDelete(menuIcon)}
              className="w-full py-4 text-center text-sm text-danger active:bg-gray-50"
            >
              🗑️ 删除图标
            </button>
            <button
              onClick={() => setMenuIcon(null)}
              className="w-full py-4 text-center text-sm text-gray-500 mt-2 bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Preset row ⋮ menu */}
      {presetMenuItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={() => setPresetMenuItem(null)}
        >
          <div
            className="w-full bg-white rounded-t-2xl pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-3 text-center text-sm text-gray-500 border-b border-gray-100">
              {presetMenuItem.name}
            </div>
            <button
              onClick={() => onReplacePreset(presetMenuItem)}
              className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
            >
              🎨 用自定义替换
            </button>
            <button
              onClick={() => setPresetMenuItem(null)}
              className="w-full py-4 text-center text-sm text-gray-500 mt-2 bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Custom preview overlay */}
      {previewIcon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPreviewIcon(null)}
        >
          <div
            className="rounded-2xl p-5 text-center mx-6"
            style={{
              background: 'white',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              minWidth: 240,
              maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{
                width: 200,
                height: 200,
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.3)',
              }}
            >
              <img
                src={getPublicIconUrl(previewIcon.image_path)}
                alt={previewIcon.name}
                draggable={false}
                className="w-full h-full object-contain p-3 pointer-events-none"
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>
              {previewIcon.name}
            </div>
            <div className="text-xs mt-1 mb-4" style={{ color: '#a0937e' }}>
              {formatSourceLabel(previewIcon.source)} · {formatRelativeDate(previewIcon.created_at)}
            </div>
            <button
              onClick={() => setPreviewIcon(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.4)',
                color: '#5a4e3c',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Preset preview overlay */}
      {presetPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPresetPreview(null)}
        >
          <div
            className="rounded-2xl p-5 text-center mx-6"
            style={{
              background: 'white',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              minWidth: 240,
              maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{
                width: 200,
                height: 200,
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.3)',
              }}
            >
              <img
                src={`/icons/${presetPreview.icon}.webp`}
                alt={presetPreview.name}
                draggable={false}
                className="w-full h-full object-contain p-3 pointer-events-none"
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>
              {presetPreview.name}
            </div>
            <div className="text-xs mt-1 mb-4" style={{ color: '#a0937e' }}>
              {presetPreview.category} · 预设
            </div>
            <button
              onClick={() => setPresetPreview(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.4)',
                color: '#5a4e3c',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <NewIconSheet
        open={showNewSheet}
        uid={uid}
        listId={list.id}
        accountId={list.account_id}
        initialName={newSheetInitialName}
        onClose={() => {
          setShowNewSheet(false);
          setNewSheetInitialName(undefined);
        }}
        onIconCreated={refresh}
      />
    </div>
  );
}
