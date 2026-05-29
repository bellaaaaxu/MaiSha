import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  persistActiveList, getStoredListId, getCachedAccount, clearStoredList,
} from '@/lib/active-list';
import { __setDurableStoreForTest } from '@/lib/durable-store';
import type { Account } from '@/types/account';
import type { List } from '@/types/list';

const account: Account = {
  id: 'acc-1', recovery_code: 'ABCD2345', member_uids: ['u1'],
  created_at: '', updated_at: '',
};
const list: List = {
  id: 'list-1', name: '家里', owner_uid: 'u1', member_uids: ['u1'],
  supermarkets: [], short_code: 'XY12Z9', account_id: 'acc-1',
  created_at: '', updated_at: '',
};

describe('active-list', () => {
  beforeEach(() => {
    localStorage.clear();
    __setDurableStoreForTest(null);
  });

  test('persistActiveList writes list id + cached account', async () => {
    await persistActiveList(account, list);
    expect(getStoredListId()).toBe('list-1');
    expect(getCachedAccount()).toEqual({ id: 'acc-1', recovery_code: 'ABCD2345' });
  });

  test('persistActiveList forwards the pointer to the durable store', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    __setDurableStoreForTest({ save, load: async () => null, clear: async () => {} });
    await persistActiveList(account, list);
    expect(save).toHaveBeenCalledWith({
      accountId: 'acc-1', recoveryCode: 'ABCD2345', activeListId: 'list-1',
    });
  });

  test('getCachedAccount returns null when absent or malformed', () => {
    expect(getCachedAccount()).toBeNull();
    localStorage.setItem('maisha:account', 'not json');
    expect(getCachedAccount()).toBeNull();
  });

  test('clearStoredList removes the list id but keeps the cached account', async () => {
    await persistActiveList(account, list);
    clearStoredList();
    expect(getStoredListId()).toBeNull();
    expect(getCachedAccount()).not.toBeNull();
  });
});
