import { getDurableStore } from './durable-store';
import type { Account } from '@/types/account';
import type { List } from '@/types/list';

const LIST_KEY = 'maisha:list-id';
const ACCOUNT_KEY = 'maisha:account';

export interface CachedAccount { id: string; recovery_code: string; }

export function getStoredListId(): string | null {
  return localStorage.getItem(LIST_KEY);
}

export function getCachedAccount(): CachedAccount | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.recovery_code === 'string') {
      return { id: parsed.id, recovery_code: parsed.recovery_code };
    }
    return null;
  } catch {
    return null;
  }
}

export function cacheAccount(account: Pick<Account, 'id' | 'recovery_code'>): void {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify({ id: account.id, recovery_code: account.recovery_code })
  );
}

export function clearStoredList(): void {
  localStorage.removeItem(LIST_KEY);
}

/** 不变量：durable store 永远镜像 localStorage 的当前指针。 */
export async function persistActiveList(account: Account, list: List): Promise<void> {
  localStorage.setItem(LIST_KEY, list.id);
  cacheAccount(account);
  await getDurableStore().save({
    accountId: account.id,
    recoveryCode: account.recovery_code,
    activeListId: list.id,
  });
}
