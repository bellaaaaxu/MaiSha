/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { StorePicker } from '../StorePicker';

beforeAll(async () => {
  await i18n.changeLanguage('zh-CN');
});

describe('StorePicker suggestions', () => {
  it('adds a store when a suggestion chip is tapped', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <StorePicker stores={[]} onChange={onChange} suggestions={['Costco', 'H Mart']} />
      </I18nextProvider>
    );
    fireEvent.click(screen.getByText('Costco'));
    expect(onChange).toHaveBeenCalledWith([{ id: 'costco', name: 'Costco' }]);
  });

  it('removes the store when an active chip is tapped again', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <StorePicker
          stores={[{ id: 'costco', name: 'Costco' }]}
          onChange={onChange}
          suggestions={['Costco']}
        />
      </I18nextProvider>
    );
    const chip = screen.getByRole('button', { pressed: true });
    fireEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders no chips without the suggestions prop', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <StorePicker stores={[]} onChange={() => {}} />
      </I18nextProvider>
    );
    expect(screen.queryByRole('button', { pressed: false })).not.toBeInTheDocument();
  });
});
