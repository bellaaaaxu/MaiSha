interface Props {
  open: boolean;
  onClose: () => void;
  onManageMarkets: () => void;
  onSettings: () => void;
  onCopyShareText: () => void;
}

export function MoreMenu({ open, onClose, onManageMarkets, onSettings, onCopyShareText }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-2xl pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-3 text-center text-sm text-gray-500 border-b border-gray-100">
          更多操作
        </div>
        <button
          onClick={() => { onCopyShareText(); onClose(); }}
          className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
        >
          📋 复制清单文本
        </button>
        <button
          onClick={() => { onManageMarkets(); onClose(); }}
          className="w-full py-4 text-center text-sm border-b border-gray-100 active:bg-gray-50"
        >
          🏪 管理超市
        </button>
        <button
          onClick={() => { onSettings(); onClose(); }}
          className="w-full py-4 text-center text-sm active:bg-gray-50"
        >
          ⚙️ 设置
        </button>
        <button
          onClick={onClose}
          className="w-full py-4 text-center text-sm text-gray-500 mt-2 bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
