import { useState } from 'react';
import { getCachedAccount } from '@/lib/active-list';

const DISMISS_KEY = 'maisha:recovery-card-dismissed';

/** ≥3 商品后出现一次的温和找回码提醒，可关掉不再来。 */
export function RecoveryCodeCard({ itemCount }: { itemCount: number }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  );
  const account = getCachedAccount();

  if (dismissed || itemCount < 3 || !account?.recovery_code) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      style={{
        margin: '12px 18px',
        padding: '14px 16px',
        background: 'white',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        borderLeft: '4px solid var(--green-soft)',
        position: 'relative',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="关闭"
        style={{
          position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--ink-faint)', padding: 2,
        }}
      >
        ×
      </button>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
        记下你的找回码
      </div>
      <div
        style={{
          fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: '0.18em',
          color: 'var(--ink)', marginTop: 4,
        }}
      >
        {account.recovery_code}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
        换手机或重装也能用它找回这份清单（设置里随时能看到）
      </div>
    </div>
  );
}
