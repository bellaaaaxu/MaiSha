/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import Wordmark from '../Wordmark';

beforeAll(async () => {
  // Force zh-CN so assertions against Chinese strings are deterministic
  // (LanguageDetector can otherwise pick navigator language in jsdom).
  await i18n.changeLanguage('zh-CN');
});

describe('Wordmark', () => {
  it('renders the brand name and Latin subtitle in hero variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="hero" />
      </I18nextProvider>
    );
    expect(screen.getByText('买啥')).toBeInTheDocument();
    expect(screen.getByText('MaiSha')).toBeInTheDocument();
  });

  it('renders the slogan in hero variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="hero" />
      </I18nextProvider>
    );
    expect(screen.getByText('去哪买，买点啥')).toBeInTheDocument();
  });

  it('does not render the slogan in mini variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Wordmark variant="mini" />
      </I18nextProvider>
    );
    expect(screen.queryByText('去哪买，买点啥')).not.toBeInTheDocument();
  });
});
