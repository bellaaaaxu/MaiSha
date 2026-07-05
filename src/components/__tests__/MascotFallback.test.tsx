import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MascotFallback } from '@/components/MascotFallback';
import { assignMascot, mascotUrl } from '@/utils/mascot-registry';

describe('MascotFallback', () => {
  it('渲染按商品名分配的小人图片', () => {
    render(<MascotFallback name="老干妈辣酱" category="调料" />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(mascotUrl(assignMascot('老干妈辣酱')));
  });

  it('图片加载失败时回退到水彩文字 blob', () => {
    render(<MascotFallback name="老干妈辣酱" category="调料" />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.queryByRole('presentation')).toBeNull();
    expect(screen.getByText('老干')).toBeInTheDocument();
  });
});
