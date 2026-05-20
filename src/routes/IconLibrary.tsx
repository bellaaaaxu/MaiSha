import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { NewIconSheet } from '@/components/NewIconSheet';
import { deleteCustomIcon, getPublicIconUrl, generateIcon, type CustomIcon } from '@/lib/custom-icons';
import { formatRelativeDate, formatSourceLabel } from '@/utils/date-format';

export default function IconLibrary() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list, loading: listLoading } = useList(uid, null);
  const { icons, refresh, loading: iconsLoading } = useCustomIcons(list?.id ?? null);

  const [showNewSheet, setShowNewSheet] = useState(false);
  const [menuIcon, setMenuIcon] = useState<CustomIcon | null>(null);
  const [previewIcon, setPreviewIcon] = useState<CustomIcon | null>(null);
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
          我的图标
        </div>
        <button
          onClick={() => setShowNewSheet(true)}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white active:opacity-80"
          style={{ background: '#7ca982' }}
        >
          + 新增
        </button>
      </header>

      <main className="p-4">
        {sortedIcons.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-6xl mb-4">🎨</div>
            <div className="text-base mb-1" style={{ color: '#a0937e' }}>还没有自定义图标</div>
            <div className="text-xs mb-6" style={{ color: '#c4b49a' }}>
              点右上角 + 新增，上传照片或用 AI 生成
            </div>
            <button
              onClick={() => setShowNewSheet(true)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white active:opacity-80"
              style={{ background: '#7ca982' }}
            >
              新增第一个
            </button>
          </div>
        ) : (
          sortedIcons.map(icon => (
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
                  className="w-full h-full object-contain rounded-xl p-1"
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
          ))
        )}
      </main>

      {/* Row ⋮ menu */}
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

      {/* Preview overlay */}
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
                className="w-full h-full object-contain p-3"
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

      <NewIconSheet
        open={showNewSheet}
        uid={uid}
        listId={list.id}
        onClose={() => setShowNewSheet(false)}
        onIconCreated={refresh}
      />
    </div>
  );
}
