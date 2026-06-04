import { useRef, useState, useCallback } from 'react';

export interface SwipeStateInput {
  deltaX: number;
  isOpen: boolean;
  actionWidth: number;
}
export interface SwipeStateOutput {
  offset: number;       // negative = open-left
  shouldOpen: boolean;
}

/** 纯函数（便于单测）：把手指移动 + 当前开合状态映射成下一帧 offset + 是否锁住。 */
export function computeSwipeState({ deltaX, isOpen, actionWidth }: SwipeStateInput): SwipeStateOutput {
  if (!isOpen) {
    if (deltaX >= 0) return { offset: 0, shouldOpen: false };
    const offset = Math.max(deltaX, -actionWidth);
    return { offset, shouldOpen: -deltaX >= actionWidth * 0.5 };
  } else {
    // open: drag rightward to close
    if (deltaX <= 0) return { offset: -actionWidth, shouldOpen: true };
    const offset = Math.min(-actionWidth + deltaX, 0);
    return { offset, shouldOpen: deltaX < actionWidth * 0.5 };
  }
}

interface UseSwipeableOpts {
  actionWidth: number;  // px revealed when open
  onOpen?: () => void;
  onClose?: () => void;
}

/** 左滑暴露动作的小 hook。返回需绑到行容器的 handlers + style offset。 */
export function useSwipeable({ actionWidth, onOpen, onClose }: UseSwipeableOpts) {
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const close = useCallback(() => {
    setOffset(0);
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const open = useCallback(() => {
    setOffset(-actionWidth);
    setIsOpen(true);
    onOpen?.();
  }, [actionWidth, onOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    draggingRef.current = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || startXRef.current === null) return;
    const deltaX = e.clientX - startXRef.current;
    // tiny dead zone to avoid hijacking vertical scroll
    if (Math.abs(deltaX) < 6) return;
    const { offset: next } = computeSwipeState({ deltaX, isOpen, actionWidth });
    setOffset(next);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current || startXRef.current === null) { draggingRef.current = false; return; }
    const deltaX = e.clientX - startXRef.current;
    const { shouldOpen } = computeSwipeState({ deltaX, isOpen, actionWidth });
    if (shouldOpen) open(); else close();
    startXRef.current = null;
    draggingRef.current = false;
  };
  const onPointerCancel = (_e: React.PointerEvent) => {
    // Cancel = user didn't intend to commit (system interrupt, force-touch, etc.)
    // Snap back to whatever state we were in BEFORE the drag began.
    if (isOpen) {
      setOffset(-actionWidth);
    } else {
      setOffset(0);
    }
    startXRef.current = null;
    draggingRef.current = false;
  };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    offset,
    isOpen,
    close,
  };
}
