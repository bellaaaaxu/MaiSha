// src/components/AiPreviewModal.tsx
interface Props {
  open: boolean;
  itemName: string;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  remainingCredits: number;
  onAccept: () => void;
  onRetry: () => void;
  onSkip: () => void;
  /** Show "watercolor-ify" button for uploaded photos */
  showStylize?: boolean;
  onStylize?: () => void;
}

export function AiPreviewModal({
  open,
  itemName,
  imageUrl,
  loading,
  error,
  remainingCredits,
  onAccept,
  onRetry,
  onSkip,
  showStylize,
  onStylize,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="rounded-3xl p-6 mx-6 w-full max-w-sm"
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div className="text-center mb-4">
          <div className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
            {loading ? '正在生成...' : error ? '生成失败' : `「${itemName}」`}
          </div>
        </div>

        {/* Preview area */}
        <div
          className="flex items-center justify-center rounded-2xl mb-4 overflow-hidden"
          style={{
            width: '100%',
            aspectRatio: '1',
            background: 'rgba(255,252,247,0.8)',
            border: '1px solid rgba(215,205,188,0.3)',
          }}
        >
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-12 h-12 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(ellipse at 40% 40%, #a8d5a2 0%, #7ca982 60%)',
                  opacity: 0.6,
                }}
              />
              <span className="text-xs" style={{ color: '#a0937e' }}>AI 正在绘制...</span>
            </div>
          )}
          {error && (
            <div className="text-center px-4">
              <span className="text-2xl mb-2 block">😅</span>
              <span className="text-xs" style={{ color: '#c97b63' }}>{error}</span>
            </div>
          )}
          {imageUrl && !loading && !error && (
            <img
              src={imageUrl}
              alt={itemName}
              className="w-full h-full object-contain p-4"
              style={{ mixBlendMode: 'multiply' }}
            />
          )}
        </div>

        {/* Credits counter */}
        <div className="text-center mb-4">
          <span className="text-[10px]" style={{ color: '#a0937e' }}>
            剩余今日额度：{remainingCredits}/5 次
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {imageUrl && !loading && !error && (
            <button
              onClick={onAccept}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white active:opacity-80"
              style={{ background: '#7ca982' }}
            >
              采用 ✓
            </button>
          )}

          {!loading && (
            <button
              onClick={onRetry}
              disabled={remainingCredits <= 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium active:opacity-80 disabled:opacity-40"
              style={{
                background: 'rgba(255,252,247,0.8)',
                border: '1px solid rgba(215,205,188,0.4)',
                color: '#5a4e3c',
              }}
            >
              {error ? '重试' : '重试 ↻'}
            </button>
          )}

          <button
            onClick={onSkip}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium active:opacity-80"
            style={{
              background: 'rgba(255,252,247,0.8)',
              border: '1px solid rgba(215,205,188,0.4)',
              color: '#a0937e',
            }}
          >
            先跳过
          </button>
        </div>

        {/* Stylize button for uploaded photos */}
        {showStylize && imageUrl && !loading && !error && (
          <button
            onClick={onStylize}
            disabled={remainingCredits <= 0}
            className="w-full mt-2 py-2 rounded-xl text-xs font-medium active:opacity-80 disabled:opacity-40"
            style={{
              background: 'rgba(124,169,130,0.1)',
              border: '1px solid rgba(124,169,130,0.3)',
              color: '#5e8a65',
            }}
          >
            🎨 转为手绘风格（消耗 1 次额度）
          </button>
        )}
      </div>
    </div>
  );
}
