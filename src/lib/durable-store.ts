export interface DurablePointer {
  accountId: string;
  recoveryCode: string;
  activeListId?: string;
}

export interface DurablePointerStore {
  save(p: DurablePointer): Promise<void>;
  load(): Promise<DurablePointer | null>;
  clear(): Promise<void>;
}

// Web/PWA 没有可跨清除存活的 durable store；Layer 1 找回码覆盖 web。
// Phase 2 会在这里按 Capacitor.getPlatform() 返回 iOS 的 NSUbiquitousKeyValueStore 实现。
const webNoopStore: DurablePointerStore = {
  async save() { /* no-op */ },
  async load() { return null; },
  async clear() { /* no-op */ },
};

let cached: DurablePointerStore | null = null;

export function getDurableStore(): DurablePointerStore {
  if (cached) return cached;
  cached = webNoopStore;
  return cached;
}

/** 测试注入口：传 store 覆盖；传 null 重置为默认。 */
export function __setDurableStoreForTest(store: DurablePointerStore | null): void {
  cached = store;
}
