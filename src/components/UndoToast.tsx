import type { UndoToastState } from '@/hooks/useUndoToast';

interface Props {
  toast: UndoToastState | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ toast, onUndo, onDismiss }: Props) {
  if (!toast) return null;

  return (
    <div
      className="fixed left-4 right-4 bottom-36 mx-auto max-w-mobile z-40 flex items-center justify-between rounded-xl px-4 py-3 shadow-lg"
      style={{
        background: 'rgba(50, 44, 35, 0.92)',
        backdropFilter: 'blur(8px)',
        animation: 'slideUp 0.25s ease-out',
      }}
    >
      <span className="text-sm text-white/90 truncate flex-1 mr-3">
        {toast.message}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onUndo}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold active:opacity-80"
          style={{ background: '#7ca982', color: '#fff' }}
        >
          撤销
        </button>
        <button
          onClick={onDismiss}
          className="text-white/50 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
