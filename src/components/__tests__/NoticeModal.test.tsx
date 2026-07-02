/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoticeModal } from '../NoticeModal';

describe('NoticeModal', () => {
  it('renders title and multi-line message', () => {
    render(
      <NoticeModal open message={'已复制\n\nAB12'} title="复制：" closeText="好" onClose={() => {}} />
    );
    expect(screen.getByText('复制：')).toBeInTheDocument();
    expect(screen.getByText(/已复制/)).toBeInTheDocument();
    expect(screen.getByText(/AB12/)).toBeInTheDocument();
  });

  it('renders without a title', () => {
    render(<NoticeModal open message="hi" closeText="好" onClose={() => {}} />);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('fires onClose when the button is clicked', () => {
    const onClose = vi.fn();
    render(<NoticeModal open message="hi" closeText="好" onClose={onClose} />);
    fireEvent.click(screen.getByText('好'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
