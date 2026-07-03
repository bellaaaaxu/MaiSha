/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { WechatBanner } from '../WechatBanner';

const WECHAT_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

beforeAll(async () => {
  await i18n.changeLanguage('zh-CN');
});

function renderBanner(ua: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <WechatBanner ua={ua} />
    </I18nextProvider>
  );
}

describe('WechatBanner', () => {
  it('renders nothing outside WeChat', () => {
    const { container } = renderBanner(SAFARI_UA);
    expect(container.innerHTML).toBe('');
  });

  it('shows the persistent bar inside WeChat', () => {
    renderBanner(WECHAT_UA);
    expect(screen.getByText('在浏览器打开，清单不丢失')).toBeInTheDocument();
  });

  it('opens the full-screen guide on tap and closes via the button', () => {
    renderBanner(WECHAT_UA);
    fireEvent.click(screen.getByText('在浏览器打开，清单不丢失'));
    expect(screen.getByText('用浏览器打开，清单不丢失')).toBeInTheDocument();
    expect(screen.getByText(/在浏览器打开.*Safari/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('我知道了'));
    expect(screen.queryByText('用浏览器打开，清单不丢失')).not.toBeInTheDocument();
  });
});
