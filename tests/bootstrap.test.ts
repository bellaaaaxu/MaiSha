import { describe, test, expect, vi } from 'vitest';
import { resolveActiveContext, type BootstrapDeps } from '@/lib/bootstrap';
import type { Account } from '@/types/account';
import type { List } from '@/types/list';

function acc(id: string, code = 'CODE0001'): Account {
  return { id, recovery_code: code, member_uids: ['u1'], created_at: '', updated_at: '' };
}
function lst(id: string, account_id = 'acc-1'): List {
  return {
    id, name: '家里', owner_uid: 'u1', member_uids: ['u1'], supermarkets: [],
    short_code: 'SC0001', account_id, state: 'active', pin_order: null,
    created_at: '', updated_at: '',
  };
}

function makeDeps(overrides: Partial<BootstrapDeps> = {}): BootstrapDeps {
  return {
    loadDurable: vi.fn().mockResolvedValue(null),
    findAccountForUid: vi.fn().mockResolvedValue(null),
    claimAccount: vi.fn().mockResolvedValue(null),
    createAccount: vi.fn().mockResolvedValue(acc('acc-new')),
    getStoredListId: vi.fn().mockReturnValue(null),
    joinOrGetList: vi.fn().mockResolvedValue(null),
    getOrCreatePrimaryList: vi.fn().mockResolvedValue(lst('list-primary', 'acc-new')),
    ...overrides,
  };
}

describe('resolveActiveContext', () => {
  test('brand-new user: no account, no durable -> create account + primary list', async () => {
    const deps = makeDeps();
    const { account, list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: null });
    expect(deps.createAccount).toHaveBeenCalledWith('u1');
    expect(deps.claimAccount).not.toHaveBeenCalled();
    expect(account.id).toBe('acc-new');
    expect(list.id).toBe('list-primary');
  });

  test('wiped but durable pointer present -> claim restores, no create', async () => {
    const deps = makeDeps({
      loadDurable: vi.fn().mockResolvedValue({
        accountId: 'acc-1', recoveryCode: 'ABCD2345', activeListId: 'list-9',
      }),
      claimAccount: vi.fn().mockResolvedValue(acc('acc-1')),
      joinOrGetList: vi.fn().mockResolvedValue(lst('list-9')),
    });
    const { account, list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: null });
    expect(deps.claimAccount).toHaveBeenCalledWith('ABCD2345');
    expect(deps.createAccount).not.toHaveBeenCalled();
    expect(deps.joinOrGetList).toHaveBeenCalledWith('list-9');
    expect(account.id).toBe('acc-1');
    expect(list.id).toBe('list-9');
  });

  test('warm start: existing account + stored list id', async () => {
    const deps = makeDeps({
      findAccountForUid: vi.fn().mockResolvedValue(acc('acc-1')),
      getStoredListId: vi.fn().mockReturnValue('list-2'),
      joinOrGetList: vi.fn().mockResolvedValue(lst('list-2')),
    });
    const { account, list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: null });
    expect(deps.claimAccount).not.toHaveBeenCalled();
    expect(deps.createAccount).not.toHaveBeenCalled();
    expect(deps.getOrCreatePrimaryList).not.toHaveBeenCalled();
    expect(account.id).toBe('acc-1');
    expect(list.id).toBe('list-2');
  });

  test('url invite overrides stored list id', async () => {
    const deps = makeDeps({
      findAccountForUid: vi.fn().mockResolvedValue(acc('acc-1')),
      getStoredListId: vi.fn().mockReturnValue('list-stored'),
      joinOrGetList: vi.fn().mockResolvedValue(lst('list-from-url')),
    });
    const { list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: 'list-from-url' });
    expect(deps.joinOrGetList).toHaveBeenCalledWith('list-from-url');
    expect(list.id).toBe('list-from-url');
  });

  test('stored list id resolves to archived list -> falls back to primary list', async () => {
    const archivedList = { ...lst('archived-id'), state: 'archived' as const };
    const deps = makeDeps({
      findAccountForUid: vi.fn().mockResolvedValue(acc('acc-1')),
      getStoredListId: vi.fn().mockReturnValue('archived-id'),
      joinOrGetList: vi.fn().mockResolvedValue(archivedList),
      getOrCreatePrimaryList: vi.fn().mockResolvedValue(lst('list-primary', 'acc-1')),
    });
    const { list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: null });
    expect(deps.joinOrGetList).toHaveBeenCalledWith('archived-id');
    expect(deps.getOrCreatePrimaryList).toHaveBeenCalledWith('acc-1', 'u1');
    expect(list.id).toBe('list-primary');
  });

  test('stale stored list id (joinOrGetList -> null) falls back to primary list', async () => {
    const deps = makeDeps({
      findAccountForUid: vi.fn().mockResolvedValue(acc('acc-1')),
      getStoredListId: vi.fn().mockReturnValue('deleted-list'),
      joinOrGetList: vi.fn().mockResolvedValue(null),
      getOrCreatePrimaryList: vi.fn().mockResolvedValue(lst('list-primary', 'acc-1')),
    });
    const { list } = await resolveActiveContext(deps, { uid: 'u1', urlListId: null });
    expect(deps.joinOrGetList).toHaveBeenCalledWith('deleted-list');
    expect(deps.getOrCreatePrimaryList).toHaveBeenCalledWith('acc-1', 'u1');
    expect(list.id).toBe('list-primary');
  });
});
