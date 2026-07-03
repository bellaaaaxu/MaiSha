/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { LanguageSheet } from '../LanguageSheet';

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN');
});

describe('LanguageSheet', () => {
  it('marks the current language as selected', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSheet open onClose={() => {}} />
      </I18nextProvider>
    );
    expect(screen.getByText('语言设置')).toBeInTheDocument();
    expect(screen.getByText('简体中文').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('English').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches language and closes on pick', async () => {
    const onClose = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSheet open onClose={onClose} />
      </I18nextProvider>
    );
    fireEvent.click(screen.getByText('繁體中文'));
    await waitFor(() => expect(i18n.language).toBe('zh-TW'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await i18n.changeLanguage('zh-CN');
  });
});
