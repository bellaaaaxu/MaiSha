import { useState, useCallback, useRef } from 'react';

export interface UndoToastState {
  message: string;
  onUndo: () => void;
}

export function useUndoToast(duration = 5000) {
  const [toast, setToast] = useState<UndoToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const show = useCallback((message: string, onUndo: () => void) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setToast({ message, onUndo });
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, duration);
  }, [duration]);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const undo = useCallback(() => {
    if (toast) {
      toast.onUndo();
      dismiss();
    }
  }, [toast, dismiss]);

  return { toast, show, dismiss, undo };
}
