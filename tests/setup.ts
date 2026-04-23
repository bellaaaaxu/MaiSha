import '@testing-library/jest-dom/vitest';

// localStorage mock for Node env (tests that don't use jsdom)
if (typeof localStorage === 'undefined') {
  const storage = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear()
  };
}
