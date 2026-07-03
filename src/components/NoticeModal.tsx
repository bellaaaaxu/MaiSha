interface Props {
  open: boolean;
  message: string;
  title?: string;
  closeText?: string;
  onClose: () => void;
}

export function NoticeModal({ open, message, title, closeText = '好', onClose }: Props) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-colors ${
        open ? 'bg-black/30 pointer-events-auto' : 'bg-black/0 pointer-events-none'
      }`}
      /* z 必须压过 SettingsDrawer(z1000)，否则从抽屉里打开时被背板盖住 */
      style={{ zIndex: 1100 }}
      onClick={onClose}
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
          {title && (
            <div className="text-base font-semibold mb-2" style={{ color: '#5a4e3c' }}>
              {title}
            </div>
          )}
          {/* pre-wrap + 可选中 + break-all：剪贴板被拒的兜底场景里，用户要长按选中这段文本手动复制（含长链接） */}
          <div
            className="text-sm"
            style={{ color: '#8a7e6b', whiteSpace: 'pre-wrap', userSelect: 'text', wordBreak: 'break-all' }}
          >
            {message}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full h-11 rounded-xl text-sm font-medium text-white active:opacity-90"
          style={{ background: '#7ca982' }}
        >
          {closeText}
        </button>
      </div>
    </div>
  );
}
