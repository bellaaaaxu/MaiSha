import { WebPlugin } from '@capacitor/core';
import type { StoreSearchPlugin } from './store-search-plugin';

// Web has no MapKit; the feature's entry points are hidden off-iOS (see platform.ts),
// so this only exists to keep registerPlugin from throwing during dev/build.
export class StoreSearchWeb extends WebPlugin implements StoreSearchPlugin {
  async search(): Promise<{ results: [] }> {
    return { results: [] };
  }
}
