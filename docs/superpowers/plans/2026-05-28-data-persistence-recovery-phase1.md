# 数据持久化与找回 — Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入账号实体作为找回锚点，让用户在 localStorage 被清后能用「找回码」手动恢复全部云端数据，并修掉「清缓存后建空清单」的隐患（在有 durable pointer 时）。

**Architecture:** 新增 `accounts` 表（账号 = 找回锚点），`claim_account` RPC 在认领时把 uid 喷进账号及其名下所有清单的 `member_uids`，使现有成员制 RLS 原样生效。客户端用一个平台无关的 `DurablePointerStore` 抽象（Phase 1 为 web no-op）+ 纯函数 `resolveActiveContext` 统一启动逻辑：账号解析（已有 → durable claim → 新建）先于清单解析（URL → localStorage → durable.activeListId → 账号首清单）。找回码在 Settings 展示、JoinByCode 支持 recover 模式、Onboarding/空状态露出恢复入口、≥3 商品后一次性卡片提醒。

**Tech Stack:** TypeScript + React 18 + Supabase (Postgres + RLS + RPC) + Vite + Vitest + Capacitor。本计划纯 web/TS + SQL，无原生代码（iCloud KVS 在 Phase 2）。

**依据 spec：** [docs/superpowers/specs/2026-05-28-data-persistence-recovery-design.md](docs/superpowers/specs/2026-05-28-data-persistence-recovery-design.md)

---

## 开工前置

- [ ] **创建隔离 worktree**（推荐）：用 superpowers:using-git-worktrees 起一个 `data-persistence-recovery` 分支/worktree，避免污染 main。
- [ ] **数据库安全须知**：Task 1 的迁移会改动**线上 Supabase**（含你的 dogfood 数据）。迁移是**附加式**的（新增表/列/策略 + 重建一条 INSERT 策略），不删数据。仍建议：先在 Supabase 控制台对 `lists` 做一次快照导出，或在 staging/branch 库先跑一遍。

---

## 文件结构

**新增：**
- `supabase/migrations/009_accounts.sql` — accounts 表、RLS、`account_id` 列 + 回填、`claim_account` RPC、重建 lists INSERT 策略
- `src/types/account.ts` — `Account` 类型
- `src/lib/durable-store.ts` — `DurablePointer` / `DurablePointerStore` 抽象 + web no-op + 平台选择 + 测试注入口
- `src/lib/active-list.ts` — 活动清单 + 账号缓存的收口读写（localStorage ↔ durable store 镜像）
- `src/lib/account.ts` — `findAccountForUid` / `createAccount` / `claimAccount`（supabase 适配器）
- `src/lib/bootstrap.ts` — 纯函数 `resolveActiveContext`（依赖注入，可测）
- `src/components/RecoveryCodeCard.tsx` — ≥3 商品后的一次性找回码卡片
- `tests/durable-store.test.ts` / `tests/active-list.test.ts` / `tests/bootstrap.test.ts`

**修改：**
- `src/types/list.ts` — 增 `account_id`
- `src/lib/db.ts` — `getOrCreateList` 替换为 `getOrCreatePrimaryList`
- `src/hooks/useList.ts` — 改用 `resolveActiveContext`
- `src/routes/JoinByCode.tsx` — 支持 `?mode=recover`（`claim_account`）
- `src/routes/Settings.tsx` — 展示账号找回码
- `src/routes/Onboarding.tsx` — step 0 露出「输入找回码恢复」入口
- `src/routes/List.tsx` — 渲染 `RecoveryCodeCard`

---

## Task 1: 数据库迁移 009（accounts + claim_account）

**Files:**
- Create: `supabase/migrations/009_accounts.sql`

- [ ] **Step 1: 写迁移文件**

写入 `supabase/migrations/009_accounts.sql`：

```sql
-- 009_accounts.sql
-- 账号实体：把数据找回锚定在账号尺度（独立于按清单的邀请码）。

-- 1. 8 位找回码生成器（字母表同 005 short_code，去掉易混字符）
CREATE OR REPLACE FUNCTION generate_recovery_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- 2. accounts 表
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code TEXT UNIQUE NOT NULL DEFAULT generate_recovery_code(),
  member_uids   UUID[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_recovery_code ON accounts(recovery_code);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read account"
  ON accounts FOR SELECT
  USING (auth.uid() = ANY(member_uids));

CREATE POLICY "members update account"
  ON accounts FOR UPDATE
  USING (auth.uid() = ANY(member_uids))
  WITH CHECK (auth.uid() = ANY(member_uids));

CREATE POLICY "authenticated create account"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = ANY(member_uids));

CREATE TRIGGER accounts_touch_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- 3. lists.account_id
ALTER TABLE lists ADD COLUMN account_id UUID REFERENCES accounts(id);

-- 4. 回填：为现有每个清单建一个账号，继承成员
DO $$
DECLARE r RECORD; new_id UUID;
BEGIN
  FOR r IN SELECT id, member_uids FROM lists WHERE account_id IS NULL LOOP
    INSERT INTO accounts (member_uids) VALUES (r.member_uids) RETURNING id INTO new_id;
    UPDATE lists SET account_id = new_id WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE lists ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX idx_lists_account_id ON lists(account_id);

-- 5. 收紧 lists INSERT：新清单必须挂在调用者所属的账号下
DROP POLICY "authenticated create list" ON lists;
CREATE POLICY "authenticated create list"
  ON lists FOR INSERT
  WITH CHECK (
    auth.uid() = owner_uid
    AND auth.uid() = ANY(member_uids)
    AND account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids))
  );

-- 6. claim_account：把 uid 加进账号 + 名下所有清单的 member_uids，使现有成员制 RLS 原样生效
CREATE OR REPLACE FUNCTION claim_account(p_code TEXT)
RETURNS accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account accounts;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_account FROM accounts WHERE recovery_code = upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF NOT (auth.uid() = ANY(v_account.member_uids)) THEN
    UPDATE accounts
      SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
      WHERE id = v_account.id
      RETURNING * INTO v_account;
  END IF;

  UPDATE lists
    SET member_uids = array_append(member_uids, auth.uid()), updated_at = NOW()
    WHERE account_id = v_account.id AND NOT (auth.uid() = ANY(member_uids));

  RETURN v_account;
END;
$$;
```

- [ ] **Step 2: 应用迁移**

用你应用 001–008 的同一方式应用：若项目已 link Supabase CLI，运行 `supabase db push`；否则把上面整段粘进 Supabase Studio → SQL Editor 执行。

- [ ] **Step 3: 验证迁移结果**

在 SQL Editor 跑以下查询：

```sql
SELECT (SELECT count(*) FROM accounts) AS accounts,
       (SELECT count(*) FROM lists)    AS lists,
       (SELECT count(*) FROM lists WHERE account_id IS NULL) AS null_account_ids;
SELECT recovery_code, length(recovery_code) AS len FROM accounts LIMIT 3;
```

Expected：`accounts == lists`，`null_account_ids == 0`，`len == 8`。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_accounts.sql
git commit -m "feat(db): add accounts entity + claim_account for data recovery"
```

---

## Task 2: 类型（Account + List.account_id）

**Files:**
- Create: `src/types/account.ts`
- Modify: `src/types/list.ts`

- [ ] **Step 1: 新增 Account 类型**

写入 `src/types/account.ts`：

```ts
export interface Account {
  id: string;
  recovery_code: string;
  member_uids: string[];
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: List 增 account_id**

编辑 `src/types/list.ts`，在 `short_code` 行下方加一行：

```ts
export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Store[];  // DB column name unchanged
  short_code: string;
  account_id: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: 类型检查**

Run: `npm run typecheck`
Expected: 报错指向 `db.ts` 里创建 list 时未提供 `account_id`（Task 6 修复）。其它无新增报错。

---

## Task 3: durable-store.ts（web no-op 抽象，TDD）

**Files:**
- Create: `src/lib/durable-store.ts`
- Test: `tests/durable-store.test.ts`

- [ ] **Step 1: 写失败测试**

写入 `tests/durable-store.test.ts`：

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import { getDurableStore, __setDurableStoreForTest } from '@/lib/durable-store';

describe('durable-store (web no-op)', () => {
  beforeEach(() => __setDurableStoreForTest(null));

  test('load() returns null on web', async () => {
    expect(await getDurableStore().load()).toBeNull();
  });

  test('save() and clear() resolve without throwing on web', async () => {
    await expect(
      getDurableStore().save({ accountId: 'a', recoveryCode: 'C' })
    ).resolves.toBeUndefined();
    await expect(getDurableStore().clear()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/durable-store.test.ts`
Expected: FAIL（`Cannot find module '@/lib/durable-store'`）。

- [ ] **Step 3: 写实现**

写入 `src/lib/durable-store.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/durable-store.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/durable-store.ts tests/durable-store.test.ts
git commit -m "feat(recovery): add DurablePointerStore abstraction (web no-op)"
```

---

## Task 4: active-list.ts（localStorage ↔ durable 镜像，TDD）

**Files:**
- Create: `src/lib/active-list.ts`
- Test: `tests/active-list.test.ts`

- [ ] **Step 1: 写失败测试**

写入 `tests/active-list.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/active-list.test.ts`
Expected: FAIL（`Cannot find module '@/lib/active-list'`）。

- [ ] **Step 3: 写实现**

写入 `src/lib/active-list.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/active-list.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/active-list.ts tests/active-list.test.ts
git commit -m "feat(recovery): add active-list (localStorage + durable mirror)"
```

---

## Task 5: account.ts（supabase 适配器）

**Files:**
- Create: `src/lib/account.ts`

> 这三个函数是薄 I/O 适配器（一条 supabase 查询/RPC）。它们的正确性由 Task 7 的 bootstrap 测试（用 fake 注入）+ Task 13 的真机/真库冒烟验证，不写单测（避免为三行包装去 mock supabase）。

- [ ] **Step 1: 写实现**

写入 `src/lib/account.ts`：

```ts
import { supabase } from './supabase';
import type { Account } from '@/types/account';

/** 找当前 uid 所属的账号（热启动路径）。 */
export async function findAccountForUid(uid: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .contains('member_uids', [uid])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Account) ?? null;
}

/** 真·新用户：建一个只含自己的账号（recovery_code 由 DB 默认生成）。 */
export async function createAccount(uid: string): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ member_uids: [uid] })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

/** 用找回码认领账号：把当前 uid 喷进账号及其名下清单。找不到码返回 null。 */
export async function claimAccount(code: string): Promise<Account | null> {
  const { data, error } = await supabase.rpc('claim_account', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return (data as Account) ?? null;
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 无 `account.ts` 相关报错（仍可能有 db.ts 的 account_id 报错，Task 6 修）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/account.ts
git commit -m "feat(recovery): add account adapters (find/create/claim)"
```

---

## Task 6: db.ts — getOrCreateList → getOrCreatePrimaryList

**Files:**
- Modify: `src/lib/db.ts:7-40`

- [ ] **Step 1: 替换 getOrCreateList**

把 [db.ts:7-40](src/lib/db.ts:7) 的整个 `getOrCreateList` 函数替换为 `getOrCreatePrimaryList`：

```ts
/** 取账号名下第一个清单；没有则创建（沿用 onboarding 选的超市）。 */
export async function getOrCreatePrimaryList(accountId: string, uid: string): Promise<List> {
  const { data: existing, error: e1 } = await supabase
    .from('lists')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing as List;

  // Use onboarding supermarket choices if available
  let supermarkets = DEFAULT_STORES;
  const onboardMarkets = localStorage.getItem('maisha:onboard-supermarkets');
  if (onboardMarkets) {
    try { supermarkets = JSON.parse(onboardMarkets); } catch { /* use default */ }
    localStorage.removeItem('maisha:onboard-supermarkets');
  }

  const { data: created, error: e2 } = await supabase
    .from('lists')
    .insert({
      name: '家里',
      owner_uid: uid,
      member_uids: [uid],
      account_id: accountId,
      supermarkets
    })
    .select()
    .single();
  if (e2) throw e2;
  return created as List;
}
```

> `joinList`（[db.ts:42](src/lib/db.ts:42)）保持不变 —— 它已返回 `List | null`，正好作 bootstrap 的 `joinOrGetList` 依赖。

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 现在报错指向 [useList.ts](src/hooks/useList.ts) 仍 import 已删除的 `getOrCreateList`（Task 8 修复）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): getOrCreatePrimaryList (account-scoped list resolution)"
```

---

## Task 7: bootstrap.ts — resolveActiveContext（纯函数，TDD）

**Files:**
- Create: `src/lib/bootstrap.ts`
- Test: `tests/bootstrap.test.ts`

- [ ] **Step 1: 写失败测试**

写入 `tests/bootstrap.test.ts`：

```ts
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
    short_code: 'SC0001', account_id, created_at: '', updated_at: '',
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/bootstrap.test.ts`
Expected: FAIL（`Cannot find module '@/lib/bootstrap'`）。

- [ ] **Step 3: 写实现**

写入 `src/lib/bootstrap.ts`：

```ts
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
  if (!list) {
    list = await deps.getOrCreatePrimaryList(account.id, uid);
  }

  return { account, list };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/bootstrap.test.ts`
Expected: PASS（5 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/bootstrap.ts tests/bootstrap.test.ts
git commit -m "feat(recovery): resolveActiveContext bootstrap (account-first, tested)"
```

---

## Task 8: useList.ts — 改用 resolveActiveContext

**Files:**
- Modify: `src/hooks/useList.ts`（整文件替换）

- [ ] **Step 1: 重写 useList**

把 `src/hooks/useList.ts` 整个替换为：

```ts
import { useEffect, useState } from 'react';
import { resolveActiveContext } from '@/lib/bootstrap';
import { getDurableStore } from '@/lib/durable-store';
import { findAccountForUid, createAccount, claimAccount } from '@/lib/account';
import { joinList, getOrCreatePrimaryList } from '@/lib/db';
import { getStoredListId, persistActiveList } from '@/lib/active-list';
import type { List } from '@/types/list';

export function useList(uid: string | null, joinListId: string | null) {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { account, list } = await resolveActiveContext(
          {
            loadDurable: () => getDurableStore().load(),
            findAccountForUid,
            claimAccount,
            createAccount,
            getStoredListId,
            joinOrGetList: joinList,
            getOrCreatePrimaryList,
          },
          { uid, urlListId: joinListId }
        );
        if (cancelled) return;
        await persistActiveList(account, list);
        if (cancelled) return;
        setList(list);
        setLoading(false);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, joinListId]);

  return { list, setList, loading, error };
}
```

- [ ] **Step 2: 类型检查 + 全量测试**

Run: `npm run typecheck && npm test`
Expected: typecheck 通过（account_id 报错消失）；所有测试 PASS。

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useList.ts
git commit -m "feat(recovery): wire useList to account-first bootstrap"
```

---

## Task 9: Settings.tsx — 展示账号找回码

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: import 缓存账号**

在 [Settings.tsx:5](src/routes/Settings.tsx:5) `generateShareText` import 下方加：

```ts
import { getCachedAccount } from '@/lib/active-list';
```

- [ ] **Step 2: 取账号 + 复制处理器**

在 [Settings.tsx:11](src/routes/Settings.tsx:11)（`useItems` 行）下方加：

```ts
  const account = getCachedAccount();

  const copyRecoveryCode = async () => {
    if (!account?.recovery_code) return;
    try {
      await navigator.clipboard.writeText(account.recovery_code);
      alert(`找回码已复制！\n\n${account.recovery_code}\n\n换手机或重装时，用它找回清单`);
    } catch {
      prompt('复制：', account.recovery_code);
    }
  };
```

- [ ] **Step 3: 渲染找回码卡片**

在 [Settings.tsx:44](src/routes/Settings.tsx:44)（`</header>` 之后、邀请码块之前）插入：

```tsx
      {account?.recovery_code && (
        <div className="mb-3 px-4 py-3 bg-white rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs" style={{ color: '#a0937e' }}>找回码</div>
              <div className="text-xl font-mono font-bold tracking-[0.2em] mt-0.5" style={{ color: '#5a4e3c' }}>
                {account.recovery_code}
              </div>
            </div>
            <button
              onClick={copyRecoveryCode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium active:opacity-80"
              style={{ background: '#7ca982', color: '#fff' }}
            >
              复制
            </button>
          </div>
          <div className="text-xs mt-2" style={{ color: '#a0937e' }}>
            换手机或重装，输入它就能找回你的清单
          </div>
        </div>
      )}
```

- [ ] **Step 4: 验证**

Run: `npm run dev`，打开 `/settings`。确认顶部出现「找回码」卡片（8 位码），点「复制」有提示。typecheck：`npm run typecheck` 通过。

- [ ] **Step 5: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "feat(recovery): show account recovery code in Settings"
```

---

## Task 10: JoinByCode.tsx — 支持 recover 模式

**Files:**
- Modify: `src/routes/JoinByCode.tsx`（整文件替换）

- [ ] **Step 1: 重写 JoinByCode**

把 `src/routes/JoinByCode.tsx` 整个替换为（新增 `?mode=recover`：调 `claimAccount`，认领后清掉旧 list-id 再回 `/list`，由 bootstrap 落到账号首清单）：

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinByCode } from '@/lib/db';
import { claimAccount } from '@/lib/account';
import { cacheAccount, clearStoredList } from '@/lib/active-list';

const STORAGE_KEY = 'maisha:list-id';

export default function JoinByCode() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const recover = params.get('mode') === 'recover';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const maxLen = recover ? 8 : 6;

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError(recover ? '请输入完整的找回码' : '请输入完整的邀请码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (recover) {
        const account = await claimAccount(trimmed);
        if (!account) {
          setError('找不到这个找回码，请检查后重试');
          setLoading(false);
          return;
        }
        cacheAccount(account);
        clearStoredList(); // 让 /list 的 bootstrap 落到账号首清单
        nav('/list', { replace: true });
      } else {
        const list = await joinByCode(trimmed);
        if (!list) {
          setError('找不到这个清单，请检查邀请码');
          setLoading(false);
          return;
        }
        localStorage.setItem(STORAGE_KEY, list.id);
        nav('/list', { replace: true });
      }
    } catch {
      setError(recover ? '找回失败，请稍后重试' : '加入失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}
    >
      <div className="text-5xl mb-4">{recover ? '🌿' : '🔑'}</div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: '#5a4e3c' }}>
        {recover ? '找回清单' : '加入清单'}
      </h1>
      <p className="text-sm mb-8" style={{ color: '#a0937e' }}>
        {recover ? '输入你的找回码' : '输入家人分享的邀请码'}
      </p>

      <div className="w-full max-w-xs space-y-4">
        <input
          type="text"
          value={code}
          onChange={e => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLen));
            setError('');
          }}
          placeholder={recover ? '例如 A3F7K2M9' : '例如 A3F7K2'}
          maxLength={maxLen}
          className="w-full text-center text-2xl font-mono tracking-[0.3em] py-4 rounded-xl outline-none"
          style={{
            background: 'rgba(255,252,247,0.7)',
            border: '1px solid rgba(215,205,188,0.5)',
            color: '#5a4e3c',
            letterSpacing: '0.3em',
          }}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        />

        {error && (
          <p className="text-xs text-center" style={{ color: '#c97b63' }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || code.length < 4}
          className="w-full h-12 rounded-xl font-semibold text-base text-white active:opacity-90 disabled:opacity-40"
          style={{ background: '#7ca982' }}
        >
          {loading ? (recover ? '找回中…' : '加入中…') : (recover ? '找回' : '加入')}
        </button>

        <button
          onClick={() => nav(-1)}
          className="w-full text-sm py-2 active:opacity-60"
          style={{ color: '#a0937e' }}
        >
          返回
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`（通过）。`npm run dev` 打开 `/join`（邀请模式，🔑）与 `/join?mode=recover`（找回模式，🌿）确认标题/文案/占位随模式变化。

- [ ] **Step 3: Commit**

```bash
git add src/routes/JoinByCode.tsx
git commit -m "feat(recovery): add recover mode to JoinByCode (claim_account)"
```

---

## Task 11: Onboarding.tsx — 露出找回入口

**Files:**
- Modify: `src/routes/Onboarding.tsx:182-198`

- [ ] **Step 1: 在底部按钮区加找回链接**

在 [Onboarding.tsx:182](src/routes/Onboarding.tsx:182) 的 `{step === 1 && (...)}` 跳过按钮块**之后**、`</div>`（底部按钮容器结束）之前，加一个仅 step 0 显示的找回入口：

```tsx
        {step === 0 && (
          <button
            onClick={() => nav('/join?mode=recover')}
            style={{
              width: '100%',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ink-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            已经用过买啥？输入找回码恢复清单
          </button>
        )}
```

- [ ] **Step 2: 验证**

Run: `npm run dev`，清掉 `maisha:seen`（DevTools → Application → Local Storage）后打开 `/onboarding`。第一屏底部出现「已经用过买啥？输入找回码恢复清单」，点击跳到 `/join?mode=recover`。`npm run typecheck` 通过。

- [ ] **Step 3: Commit**

```bash
git add src/routes/Onboarding.tsx
git commit -m "feat(recovery): surface recover entry on onboarding step 0"
```

---

## Task 12: RecoveryCodeCard + List 集成

**Files:**
- Create: `src/components/RecoveryCodeCard.tsx`
- Modify: `src/routes/List.tsx`

- [ ] **Step 1: 写组件**

写入 `src/components/RecoveryCodeCard.tsx`：

```tsx
import { useState } from 'react';
import { getCachedAccount } from '@/lib/active-list';

const DISMISS_KEY = 'maisha:recovery-card-dismissed';

/** ≥3 商品后出现一次的温和找回码提醒，可关掉不再来。 */
export function RecoveryCodeCard({ itemCount }: { itemCount: number }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  );
  const account = getCachedAccount();

  if (dismissed || itemCount < 3 || !account?.recovery_code) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      style={{
        margin: '12px 18px',
        padding: '14px 16px',
        background: 'white',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        borderLeft: '4px solid var(--green-soft)',
        position: 'relative',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="关闭"
        style={{
          position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--ink-faint)', padding: 2,
        }}
      >
        ×
      </button>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
        记下你的找回码
      </div>
      <div
        style={{
          fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: '0.18em',
          color: 'var(--ink)', marginTop: 4,
        }}
      >
        {account.recovery_code}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
        换手机或重装也能用它找回这份清单（设置里随时能看到）
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 List 渲染卡片**

在 [List.tsx:23](src/routes/List.tsx:23)（`ImportSheet` import 行）下方加：

```ts
import { RecoveryCodeCard } from '@/components/RecoveryCodeCard';
```

然后在 [List.tsx:232](src/routes/List.tsx:232) 的 `{activeTab === 'list' && (` 紧随其后的 `<>` 之后插入卡片（位于清单内容之上）：

```tsx
        {activeTab === 'list' && (
          <>
            <RecoveryCodeCard itemCount={items.length} />
            {groups.length === 0 ? (
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`（通过）。`npm run dev`：清单加到 ≥3 个商品后，列表上方出现找回码卡片；点 × 关闭后刷新不再出现（`maisha:recovery-card-dismissed=1`）。商品 <3 时不显示。

- [ ] **Step 4: Commit**

```bash
git add src/components/RecoveryCodeCard.tsx src/routes/List.tsx
git commit -m "feat(recovery): one-time recovery code card after 3+ items"
```

---

## Task 13: 全量验证 + 真库冒烟

**Files:** 无（验证 + 收尾）

- [ ] **Step 1: 全量测试 + 类型 + 构建**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全部通过（durable-store 2 + active-list 4 + bootstrap 5 + 既有 frequent-items 8 = 全绿；tsc 无错；vite build 成功）。

- [ ] **Step 2: 真库冒烟 —— 新用户**

清空浏览器 localStorage，`npm run dev` 打开应用：走完 onboarding → 进入清单。到 Supabase 确认：`accounts` 多了一行（8 位 recovery_code），新 `lists` 行的 `account_id` 指向它。Settings 里「找回码」与该 recovery_code 一致。

- [ ] **Step 3: 真库冒烟 —— 找回（核心）**

1. 记下当前 Settings 里的找回码，往清单加 ≥3 个商品。
2. DevTools → Application → Local Storage → 全部清空（模拟 wipe），刷新页面。
3. 这会变成「新用户」：走 onboarding，第一屏点「已经用过买啥？输入找回码恢复清单」→ 输入刚才的找回码 → 点「找回」。
4. Expected：跳回 `/list`，**原来的商品、自建店铺、自定义图标全部回来**。Supabase 里该账号的 `member_uids` 多了一个新 uid，名下清单的 `member_uids` 也多了同一个新 uid。

- [ ] **Step 4: 真库冒烟 —— 邀请未回归**

打开 `/join`（无 mode）确认仍是邀请模式（🔑、6 位），输入某清单 `short_code` 仍能加入 —— 邀请流程未被破坏。

- [ ] **Step 5: 收尾**

```bash
git status   # 确认无遗漏
```

用 superpowers:finishing-a-development-branch 决定合并/PR。然后回到 spec，准备 **Phase 2**（iCloud KVS 原生插件）的计划。

---

## 自检（已对照 spec）

- **Spec 覆盖**：§4.1 accounts（T1/T2）、§4.2 account_id（T1/T2）、§4.3 spray 授权（T1 claim_account）、§4.4 claim_account（T1）、§5 DurablePointerStore（T3）、§7 bootstrap + active-list（T4/T7/T8）、§8 迁移（T1）、§9 找回码 UX（T9/T10/T11/T12）。§6 KVS、§3 Layer 2、冷启动宽限 = Phase 2，不在本计划。
- **无占位符**：每个改码步骤都附完整代码。
- **类型一致**：`Account`、`List.account_id`、`DurablePointer`、`BootstrapDeps`、`resolveActiveContext`、`persistActiveList`/`getStoredListId`/`getCachedAccount`/`cacheAccount`/`clearStoredList`、`findAccountForUid`/`createAccount`/`claimAccount`、`getOrCreatePrimaryList`、`joinList`（既有，作 `joinOrGetList` 依赖）跨任务签名一致。
