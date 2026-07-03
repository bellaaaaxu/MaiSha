interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm, onCancel
}: Props) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-colors ${
        open ? 'bg-black/30 pointer-events-auto' : 'bg-black/0 pointer-events-none'
      }`}
      /* z 必须压过 SettingsDrawer(z1000)，否则从抽屉里打开时被背板盖住 */
      style={{ zIndex: 1100 }}
      onClick={onCancel}
    >
      <div
        className={`mx-6 w-full max-w-xs rounded-3xl p-6 transition-all ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          border: '1px solid rgba(215,205,188,0.5)',
          boxShadow: '0 8px 32px rgba(100,80,50,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-base font-semibold mb-2" style={{ color: '#5a4e3c' }}>
            {title}
          </div>
          <div className="text-sm" style={{ color: '#8a7e6b' }}>
            {message}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl text-sm font-medium active:opacity-80"
            style={{
              background: 'rgba(255,252,247,0.6)',
              border: '1px solid rgba(215,205,188,0.4)',
              color: '#8a7e6b',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-xl text-sm font-medium text-white active:opacity-90"
            style={{ background: '#7ca982' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
