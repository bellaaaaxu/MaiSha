import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.restoreAllMocks());

describe('isStoreFinderAvailable', () => {
  it('true on ios', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
    const { isStoreFinderAvailable } = await import('../platform');
    expect(isStoreFinderAvailable()).toBe(true);
  });

  it('false on web', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' } }));
    const { isStoreFinderAvailable } = await import('../platform');
    expect(isStoreFinderAvailable()).toBe(false);
  });
});
