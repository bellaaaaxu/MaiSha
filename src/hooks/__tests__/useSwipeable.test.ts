import { describe, it, expect } from 'vitest';
import { computeSwipeState } from '../useSwipeable';

describe('computeSwipeState', () => {
  const ACTION_PX = 126; // 3 buttons × 42px
  const COMMIT = ACTION_PX * 0.5; // threshold

  it('idle when deltaX = 0', () => {
    expect(computeSwipeState({ deltaX: 0, isOpen: false, actionWidth: ACTION_PX })).toEqual({
      offset: 0,
      shouldOpen: false,
    });
  });

  it('follows finger but caps at actionWidth', () => {
    expect(computeSwipeState({ deltaX: -50, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(-50);
    expect(computeSwipeState({ deltaX: -200, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(-ACTION_PX);
  });

  it('ignores rightward drag when closed', () => {
    expect(computeSwipeState({ deltaX: 30, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(0);
  });

  it('shouldOpen=true if drag past threshold', () => {
    expect(computeSwipeState({ deltaX: -(COMMIT + 1), isOpen: false, actionWidth: ACTION_PX }).shouldOpen).toBe(true);
    expect(computeSwipeState({ deltaX: -(COMMIT - 1), isOpen: false, actionWidth: ACTION_PX }).shouldOpen).toBe(false);
  });

  it('when open, drag right > threshold closes', () => {
    const r = computeSwipeState({ deltaX: ACTION_PX * 0.6, isOpen: true, actionWidth: ACTION_PX });
    expect(r.shouldOpen).toBe(false);
  });
});
