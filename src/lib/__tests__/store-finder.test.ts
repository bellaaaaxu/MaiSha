import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { List } from '@/types/list';

vi.mock('@/lib/db', () => ({
  updateListSupermarkets: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
}));
import { updateListSupermarkets, addItem } from '@/lib/db';
import { commitStoreChoice } from '../store-finder';

const baseList = {
  id: 'list-1',
  supermarkets: [{ id: 'sm_a', name: '大华超市', lat: 0, lng: 0 }],
} as unknown as List;

beforeEach(() => vi.clearAllMocks());

describe('commitStoreChoice', () => {
  it('reuses an existing store (no supermarkets update) and adds the item to it', async () => {
    await commitStoreChoice(baseList, 'uid-1', '日本酱油', { name: '大华超市', lat: 0, lng: 0 });
    expect(updateListSupermarkets).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledWith('list-1', 'uid-1', { name: '日本酱油', supermarket: 'sm_a' });
  });

  it('adds a new store, then adds the item to the new store id', async () => {
    await commitStoreChoice(baseList, 'uid-1', '寿司醋', { name: 'T&T 大统华', lat: 1, lng: 1, address: '99 Rd' });
    expect(updateListSupermarkets).toHaveBeenCalledTimes(1);
    const [listId, stores] = (updateListSupermarkets as any).mock.calls[0];
    expect(listId).toBe('list-1');
    expect(stores).toHaveLength(2);
    const added = stores[1];
    expect(added.name).toBe('T&T 大统华');
    expect((addItem as any).mock.calls[0][2].supermarket).toBe(added.id);
  });
});

// ---------------------------------------------------------------------------
// Invalid-coordinate filter in findStoresFor
// The native bridge defaults missing coordinates to (0,0) — a real point off
// Africa — which would pollute distance ranking. We verify the filter drops
// those results before they reach dedupeAndRank.
// ---------------------------------------------------------------------------
describe('findStoresFor — invalid-coord filter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('drops (0,0) results and non-finite coords, keeps valid ones', async () => {
    // Mock the dependencies before importing the module under test
    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'tok' } },
          }),
        },
      },
    }));

    vi.doMock('@/lib/db', () => ({
      updateListSupermarkets: vi.fn(),
      addItem: vi.fn(),
    }));

    vi.doMock('../store-search-plugin', () => ({
      StoreSearch: {
        search: vi.fn().mockResolvedValue({
          results: [
            // Valid result — should be kept
            { name: 'Valid Store', lat: 37.77, lng: -122.41, address: '1 Main St', matchedTerm: '超市', category: '' },
            // (0,0) — native bridge placeholder, should be dropped
            { name: 'Zero Store', lat: 0, lng: 0, address: '', matchedTerm: '超市', category: '' },
            // Non-finite lat — should be dropped
            { name: 'NaN Store', lat: NaN, lng: -122.0, address: '', matchedTerm: '超市', category: '' },
            // Non-finite lng — should be dropped
            { name: 'Inf Store', lat: 37.77, lng: Infinity, address: '', matchedTerm: '超市', category: '' },
          ],
        }),
      },
    }));

    vi.doMock('./store-finder-utils', async () => {
      const actual = await vi.importActual<typeof import('../store-finder-utils')>('../store-finder-utils');
      return {
        ...actual,
        selectSearchTerms: vi.fn().mockReturnValue(['超市']),
      };
    });

    // Stub global fetch so resolveStoreTypes returns valid keywords
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keywords: [{ term: '超市', tier: 3 }] }),
    }));

    const { findStoresFor } = await import('../store-finder');
    const results = await findStoresFor('酱油', { lat: 37.77, lng: -122.41 });

    // Only the valid result should survive
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Valid Store');

    vi.unstubAllGlobals();
  });
});
