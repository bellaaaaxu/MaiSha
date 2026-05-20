import { useCallback, useRef, useState } from 'react';

interface Options {
  threshold?: number;       // ms before long-press fires (default 400)
  moveTolerance?: number;   // px movement allowed during press (default 8)
  onCancel?: () => void;    // called if press was cancelled
}

interface PressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

interface UseLongPressReturn {
  handlers: PressHandlers;
  /** True between 200ms and threshold — shows "press registered" visual */
  isPressing: boolean;
  /** True once threshold met — long press has fired */
  isLongPressed: boolean;
}

/**
 * Hook that distinguishes tap from long-press with touch safety:
 * - Tap (< threshold): triggers nothing; caller's onClick fires normally on release
 * - Long-press (>= threshold): fires onLongPress; release won't trigger caller's onClick
 * - Movement > moveTolerance: cancels press (allows scrolling)
 *
 * Usage:
 *   const { handlers, isLongPressed } = useLongPress(() => showPreview());
 *   <button {...handlers} onClick={(e) => {
 *     if (isLongPressed) { e.preventDefault(); return; }
 *     addItem();
 *   }}>
 */
export function useLongPress(
  onLongPress: () => void,
  options: Options = {}
): UseLongPressReturn {
  const { threshold = 400, moveTolerance = 8, onCancel } = options;

  const [isPressing, setIsPressing] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pressVisualTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pressVisualTimerRef.current !== null) {
      window.clearTimeout(pressVisualTimerRef.current);
      pressVisualTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setIsPressing(false);
    startPosRef.current = null;
    // Note: don't reset longPressedRef here — it's read by the click handler
    // that fires after pointer up. It's reset on the next pointer down.
  }, [clearTimers]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    longPressedRef.current = false;
    setIsLongPressed(false);
    startPosRef.current = { x: e.clientX, y: e.clientY };

    // Visual feedback at 200ms (halfway to threshold)
    pressVisualTimerRef.current = window.setTimeout(() => {
      setIsPressing(true);
    }, Math.min(200, threshold / 2));

    // Long-press fires at threshold
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setIsLongPressed(true);
      setIsPressing(false);
      onLongPress();
    }, threshold);
  }, [onLongPress, threshold]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > moveTolerance) {
      if (!longPressedRef.current) {
        reset();
        onCancel?.();
      }
    }
  }, [moveTolerance, onCancel, reset]);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    reset();
  }, [reset]);

  const onPointerCancel = useCallback((_e: React.PointerEvent) => {
    reset();
  }, [reset]);

  const onPointerLeave = useCallback((_e: React.PointerEvent) => {
    if (!longPressedRef.current && timerRef.current) {
      reset();
      onCancel?.();
    }
  }, [onCancel, reset]);

  return {
    handlers: { onPointerDown, onPointerUp, onPointerMove, onPointerCancel, onPointerLeave },
    isPressing,
    isLongPressed,
  };
}

/** Helper for callers: returns true if the click should be suppressed (long-press fired) */
export function wasLongPress(refLikeBoolean: boolean): boolean {
  return refLikeBoolean;
}
