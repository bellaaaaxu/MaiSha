import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecorFallback } from '@/components/DecorFallback';
import { assignDecor, decorUrl } from '@/utils/decor-registry';

describe('DecorFallback', () => {
  it('渲染按商品名分配的花贴纸', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(decorUrl(assignDecor('老干妈辣酱')));
  });

  it('渲染首字角标', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    expect(screen.getByText('老')).toBeInTheDocument();
  });

  it('英文商品角标取首字母大写', () => {
    render(<DecorFallback name="shampoo" category="其他" />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('花图加载失败回退水彩文字 blob', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.queryByRole('presentation')).toBeNull();
    expect(screen.getByText('老干')).toBeInTheDocument();
  });
});
