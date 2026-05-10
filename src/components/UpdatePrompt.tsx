import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 mx-auto max-w-mobile px-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)',
          border: '1px solid rgba(124,169,130,0.4)',
          boxShadow: '0 8px 24px rgba(100,80,50,0.15)',
        }}
      >
        <span className="text-xl">✨</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: '#5a4e3c' }}>
            新版本可用
          </div>
          <div className="text-xs" style={{ color: '#a0937e' }}>
            刷新即可使用最新功能
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-xs px-2 py-1 rounded-lg active:opacity-60"
          style={{ color: '#a0937e' }}
        >
          稍后
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-xs px-3 py-1.5 rounded-full text-white font-medium active:opacity-80"
          style={{ background: '#7ca982' }}
        >
          刷新
        </button>
      </div>
    </div>
  );
}
