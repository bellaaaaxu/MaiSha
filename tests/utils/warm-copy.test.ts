import { describe, it, expect } from 'vitest';
import { getProgressText, getEmptyListText, getAddSheetTitle } from '@/utils/warm-copy';

describe('warm-copy', () => {
  it('getProgressText shows remaining', () => {
    expect(getProgressText(3, 8)).toBe('快买完啦，还差 3 样~');
  });

  it('getProgressText shows done when 0 remain', () => {
    expect(getProgressText(0, 5)).toBe('全部买完啦！');
  });

  it('getEmptyListText returns warm message', () => {
    const text = getEmptyListText();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  it('getAddSheetTitle returns warm greeting', () => {
    expect(getAddSheetTitle()).toBe('今天想吃什么？');
  });
});
