/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WashiTape from '../WashiTape';

describe('WashiTape', () => {
  it('renders an img with the given src and empty alt', () => {
    render(<WashiTape src="/decorations/washi-coral.webp" />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/decorations/washi-coral.webp');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('applies rotation and width via inline style', () => {
    render(<WashiTape src="/decorations/washi-coral.webp" rotation={-5} width={120} />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.style.transform).toContain('rotate(-5deg)');
    expect(img.style.width).toBe('120px');
  });
});
