import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SealImprint } from '@/components/SealImprint';

describe('SealImprint', () => {
  it('用花图作 CSS mask、印泥朱红打底', () => {
    const { container } = render(<SealImprint sealId="gui" size={64} />);
    const ink = container.querySelector('[data-seal-ink]') as HTMLElement;
    expect(ink.style.maskImage || ink.style.webkitMaskImage).toContain('/flora/gui.webp');
    expect(ink.style.background).toBe('rgb(176, 68, 44)');   // #B0442C
  });
  it('未拥有态渲染虚线空印框、无印泥', () => {
    const { container } = render(<SealImprint sealId="mei" size={64} empty />);
    expect(container.querySelector('[data-seal-ink]')).toBeNull();
  });
});
