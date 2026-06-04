import type { Account } from '@/types/account';
import type { List } from '@/types/list';
import type { DurablePointer } from './durable-store';

export interface BootstrapDeps {
  loadDurable: () => Promise<DurablePointer | null>;
  findAccountForUid: (uid: string) => Promise<Account | null>;
  claimAccount: (code: string) => Promise<Account | null>;
  createAccount: (uid: string) => Promise<Account>;
  getStoredListId: () => string | null;
  joinOrGetList: (listId: string) => Promise<List | null>;
  getOrCreatePrimaryList: (accountId: string, uid: string) => Promise<List>;
}

export interface BootstrapInput {
  uid: string;
  urlListId: string | null;
}

/**
 * 启动解析：先定账号（已有 → durable claim → 新建），再定活动清单
 * （URL → localStorage → durable.activeListId → 账号首清单）。
 * 账号解析在建新清单之前 → 有 durable 指针时不会误建空清单。
 */
export async function resolveActiveContext(
  deps: BootstrapDeps,
  { uid, urlListId }: BootstrapInput
): Promise<{ account: Account; list: List }> {
  const pointer = await deps.loadDurable();

  let account = await deps.findAccountForUid(uid);
  if (!account && pointer?.recoveryCode) {
    account = await deps.claimAccount(pointer.recoveryCode);
  }
  if (!account) {
    account = await deps.createAccount(uid);
  }

  const listId = urlListId || deps.getStoredListId() || pointer?.activeListId || null;
  let list: List | null = null;
  if (listId) {
    list = await deps.joinOrGetList(listId);
  }
  // If stored pointer resolved to an archived list (e.g. family member archived it),
  // fall back to the account's primary live list — don't surface a stale list as "current."
  if (list && list.state === 'archived') {
    list = null;
  }
  if (!list) {
    list = await deps.getOrCreatePrimaryList(account.id, uid);
  }

  return { account, list };
}
