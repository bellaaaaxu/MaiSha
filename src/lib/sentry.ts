import * as Sentry from '@sentry/react';

// errors-only：不开 tracing/replay，包重与免费额度都最省；
// 双门槛（DSN 存在 + 生产构建）保证本地开发与测试零噪音
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;
  Sentry.init({
    dsn,
    environment: 'production',
    sendDefaultPii: false,
  });
}
