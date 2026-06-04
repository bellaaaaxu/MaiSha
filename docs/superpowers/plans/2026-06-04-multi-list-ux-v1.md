# 多清单 UX v1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让一个账号下支持多个清单（固定 / 进行中 / 已归档），主屏保持当前清单不变，头部新增水彩切换/邀请图标，从 B「我的清单」可一键切换、长按或左滑做操作；提供 A 全部 + 归档总览。

**Architecture:** 后端地基（`lists.account_id` + bootstrap + 账号化图标库）已上线，本计划纯增量：一支 ~70 行迁移给 `lists` 加 `state` + `pin_order` 与两支护栏 RPC；前端新增 5 个组件 + 2 路由 + 1 hook，改 4 个现有文件。复用现有 `useLongPress`；左滑写一个 ~80 行小 hook 不引入新 deps。

**Tech Stack:** React 18 + Vite + TS, Supabase (RPC + RLS), vitest + RTL, react-i18next. Spec: `docs/superpowers/specs/2026-06-04-multi-list-ux-design.md`.

**Verification reality:** TDD 跑 3 个纯函数（`sortLists` / `canArchive` / `validateListName`）与 1 个 swipe threshold；其他 Supabase I/O + UI 用 `tsc --noEmit` + `vitest run`（现有 99 全绿）+ `npm run build` + spec §「验证 / 自测要点」浏览器冒烟把守。**Migration 012 由用户手动应用**（Task 17）。

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/012_multi_list.sql` | Create | `lists.state` + `pin_order` 列 + 索引 + 回填「家里」为 pinned + `set_list_state` / `delete_list` RPC |
| `src/types/list.ts` | Modify | 加 `state` / `pin_order` 字段 |
| `src/lib/db.ts` | Modify | 加 `createList` / `renameList` / `setListState` / `deleteList` |
| `src/lib/list-sort.ts` | Create | 纯函数 `sortLists` + `canArchive` + `validateListName` |
| `src/lib/__tests__/list-sort.test.ts` | Create | 上述三函数的 vitest |
| `src/hooks/useLists.ts` | Create | 拉账号下所有清单，按 state 分组+排序，含 items count 批量预取 |
| `src/hooks/useSwipeable.ts` | Create | 触摸+鼠标的左滑小 hook（~80 行）；返回 `{handlers, swipeOffset, isOpen, close}` |
| `src/hooks/__tests__/useSwipeable.test.ts` | Create | threshold 行为单测 |
| `src/components/ListSwitcherIcon.tsx` | Create | 水彩 SVG 占位「一叠卡片」（用户后续替换为手绘） |
| `src/components/PaperPlaneIcon.tsx` | Create | 水彩 SVG 占位「纸飞机」 |
| `src/components/StorePicker.tsx` | Create | 从 Onboarding step 2 抽出的店铺选择 chips |
| `src/routes/Onboarding.tsx` | Modify | step 2 内联 chips 改为引用 `<StorePicker>` |
| `src/components/NewListSheet.tsx` | Create | 半屏新建清单表单（名称 + `<StorePicker>`） |
| `src/components/ListActionSheet.tsx` | Create | 长按完整操作面板（沿用 MoreMenu 视觉） |
| `src/components/ListRow.tsx` | Create | 一行清单：左滑 3 色块 + 长按 sheet + 轻点切换 |
| `src/routes/MyLists.tsx` | Create | B 视图：固定 / 进行中 / 已归档（默认折叠）+ ＋按钮 + 查看全部链接 |
| `src/routes/AllLists.tsx` | Create | A 视图：3 列卡片墙 + Bounce 入场 + 全部归档展开 |
| `src/routes/List.tsx` | Modify | 头部：标题改 `list.name`、加 `<ListSwitcherIcon>` 按钮、替换文字「邀请」为 `<PaperPlaneIcon>` |
| `src/App.tsx` | Modify | 加路由 `/my-lists` 与 `/all-lists` |
| `src/locales/zh-CN.json` | Modify | 加 `myLists.*` / `allLists.*` / `newList.*` / `listActions.*` 等 keys |
| `src/locales/zh-TW.json` | Modify | 同上 |
| `src/locales/en.json` | Modify | 同上 |

---

## Task 1: Migration 012 — schema + RPCs

**Files:** Create `supabase/migrations/012_multi_list.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 012_multi_list.sql
-- Multi-list: state column (pinned/active/archived) + pin_order + guarded RPCs.

ALTER TABLE lists
  ADD COLUMN state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'pinned', 'archived')),
  ADD COLUMN pin_order integer;

CREATE INDEX lists_account_state_idx ON lists (account_id, state);

-- Existing 「家里」 lists default to pinned (users expect 「家里」 always on top).
UPDATE lists SET state = 'pinned', pin_order = 0
  WHERE name = '家里' AND state = 'active';

-- Set a list's state with guardrail: reject if archiving would leave 0 active+pinned.
CREATE OR REPLACE FUNCTION set_list_state(
  p_list_id uuid,
  p_state text,
  p_pin_order integer DEFAULT NULL
) RETURNS lists
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_active_count integer;
  v_result lists;
BEGIN
  SELECT account_id INTO v_account_id FROM lists
  WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF p_state = 'archived' THEN
    SELECT count(*) INTO v_active_count FROM lists
    WHERE account_id = v_account_id
      AND state IN ('active', 'pinned')
      AND id <> p_list_id;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'cannot archive the last active list';
    END IF;
  END IF;

  UPDATE lists
    SET state = p_state,
        pin_order = CASE WHEN p_state = 'pinned' THEN p_pin_order ELSE NULL END,
        updated_at = now()
    WHERE id = p_list_id
    RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- Delete a list with same guardrail (last active+pinned cannot be removed).
CREATE OR REPLACE FUNCTION delete_list(p_list_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_active_count integer;
  v_state text;
BEGIN
  SELECT account_id, state INTO v_account_id, v_state FROM lists
    WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF v_state IN ('active', 'pinned') THEN
    SELECT count(*) INTO v_active_count FROM lists
      WHERE account_id = v_account_id
        AND state IN ('active', 'pinned')
        AND id <> p_list_id;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'cannot delete the last active list';
    END IF;
  END IF;

  DELETE FROM lists WHERE id = p_list_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_list_state(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_list(uuid) TO anon, authenticated;
```

- [ ] **Step 2: Commit** (apply is Task 17, by the user)

```bash
git add supabase/migrations/012_multi_list.sql
git commit -m "feat(multi-list): migration 012 - state/pin_order + guarded RPCs"
```

---

## Task 2: Update `List` type

**Files:** Modify `src/types/list.ts`

- [ ] **Step 1: Add fields**

```typescript
import type { Store } from './store';

export type ListState = 'active' | 'pinned' | 'archived';

export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Store[];  // DB column name unchanged
  short_code: string;
  account_id: string;
  state: ListState;
  pin_order: number | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors (existing code that constructs `List` rows treats them opaquely; defaults from DB fill `state`/`pin_order`).

- [ ] **Step 3: Commit**

```bash
git add src/types/list.ts
git commit -m "feat(multi-list): add state/pin_order to List type"
```

---

## Task 3: `db.ts` CRUD for lists

**Files:** Modify `src/lib/db.ts`

- [ ] **Step 1: Append new functions** (after the existing `clearAllItems` export, ~line 119)

```typescript
import type { List, ListState } from '@/types/list';
import type { Store } from '@/types/store';

/** 创建新清单（自动 active；自动 owner=member）。 */
export async function createList(
  accountId: string,
  uid: string,
  name: string,
  supermarkets: Store[]
): Promise<List> {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      name,
      owner_uid: uid,
      member_uids: [uid],
      account_id: accountId,
      supermarkets,
    })
    .select()
    .single();
  if (error) throw error;
  return data as List;
}

/** 重命名（直接 update；RLS 允许成员写）。 */
export async function renameList(listId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ name })
    .eq('id', listId);
  if (error) throw error;
}

/** 设置状态（pinned/active/archived），含 DB 护栏。 */
export async function setListState(
  listId: string,
  state: ListState,
  pinOrder?: number | null
): Promise<List> {
  const { data, error } = await supabase.rpc('set_list_state', {
    p_list_id: listId,
    p_state: state,
    p_pin_order: pinOrder ?? null,
  });
  if (error) throw error;
  return data as List;
}

/** 删除清单，含 DB 护栏（拒绝删最后一个 active+pinned）。 */
export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_list', { p_list_id: listId });
  if (error) throw error;
}

/** 列出某账号下的所有清单（含 archived）。 */
export async function fetchListsByAccount(accountId: string): Promise<List[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as List[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(multi-list): data layer CRUD + state RPC wrappers"
```

---

## Task 4: Pure helpers — `sortLists`, `canArchive`, `validateListName` (TDD)

**Files:** Create `src/lib/list-sort.ts`, `src/lib/__tests__/list-sort.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/__tests__/list-sort.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sortLists, canArchive, validateListName } from '../list-sort';
import type { List } from '@/types/list';

const mk = (over: Partial<List>): List => ({
  id: over.id ?? 'x',
  name: over.name ?? 'x',
  owner_uid: 'u',
  member_uids: ['u'],
  supermarkets: [],
  short_code: '',
  account_id: 'a',
  state: 'active',
  pin_order: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: over.updated_at ?? '2026-01-01T00:00:00Z',
  ...over,
});

describe('sortLists', () => {
  it('groups by state', () => {
    const rows = [
      mk({ id: '1', state: 'pinned', pin_order: 0 }),
      mk({ id: '2', state: 'active' }),
      mk({ id: '3', state: 'archived' }),
    ];
    const g = sortLists(rows);
    expect(g.pinned.map(r => r.id)).toEqual(['1']);
    expect(g.active.map(r => r.id)).toEqual(['2']);
    expect(g.archived.map(r => r.id)).toEqual(['3']);
  });

  it('pinned sorted by pin_order ASC, NULLS LAST, then updated_at DESC', () => {
    const rows = [
      mk({ id: 'b', state: 'pinned', pin_order: 1, updated_at: '2026-02-01T00:00:00Z' }),
      mk({ id: 'a', state: 'pinned', pin_order: 0, updated_at: '2026-01-01T00:00:00Z' }),
      mk({ id: 'c', state: 'pinned', pin_order: null, updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(sortLists(rows).pinned.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('active/archived sorted by updated_at DESC', () => {
    const rows = [
      mk({ id: 'old', state: 'active', updated_at: '2026-01-01T00:00:00Z' }),
      mk({ id: 'new', state: 'active', updated_at: '2026-03-01T00:00:00Z' }),
    ];
    expect(sortLists(rows).active.map(r => r.id)).toEqual(['new', 'old']);
  });
});

describe('canArchive', () => {
  const a = mk({ id: 'a', state: 'pinned' });
  const b = mk({ id: 'b', state: 'active' });
  const c = mk({ id: 'c', state: 'archived' });

  it('false if it is the last active+pinned', () => {
    expect(canArchive(a, [a, c])).toBe(false); // only 'a' is non-archived
  });
  it('true if other active+pinned exist', () => {
    expect(canArchive(a, [a, b, c])).toBe(true);
  });
  it('true for an already-archived list (no-op, but allowed)', () => {
    expect(canArchive(c, [a, c])).toBe(true);
  });
});

describe('validateListName', () => {
  it('rejects empty', () => {
    expect(validateListName('').ok).toBe(false);
    expect(validateListName('   ').ok).toBe(false);
  });
  it('rejects > 20 chars (after trim)', () => {
    expect(validateListName('a'.repeat(21)).ok).toBe(false);
  });
  it('accepts trimmed 1..20 chars', () => {
    expect(validateListName('家里').ok).toBe(true);
    expect(validateListName('a'.repeat(20)).ok).toBe(true);
    expect(validateListName('  家里  ').ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `npx vitest run src/lib/__tests__/list-sort.test.ts`
Expected: FAIL — `Cannot find module '../list-sort'`.

- [ ] **Step 3: Implement** (`src/lib/list-sort.ts`)

```typescript
import type { List } from '@/types/list';

export interface SortedLists {
  pinned: List[];
  active: List[];
  archived: List[];
}

/** 排序：pinned 按 pin_order ASC NULLS LAST 再 updated_at DESC；active/archived 按 updated_at DESC。 */
export function sortLists(rows: List[]): SortedLists {
  const cmpUpdatedDesc = (a: List, b: List) =>
    b.updated_at.localeCompare(a.updated_at);
  const pinned = rows
    .filter(r => r.state === 'pinned')
    .sort((a, b) => {
      const ao = a.pin_order, bo = b.pin_order;
      if (ao === null && bo === null) return cmpUpdatedDesc(a, b);
      if (ao === null) return 1;
      if (bo === null) return -1;
      if (ao !== bo) return ao - bo;
      return cmpUpdatedDesc(a, b);
    });
  const active = rows.filter(r => r.state === 'active').sort(cmpUpdatedDesc);
  const archived = rows.filter(r => r.state === 'archived').sort(cmpUpdatedDesc);
  return { pinned, active, archived };
}

/** 是否允许归档：若它是仅剩的 active+pinned，则不行。 */
export function canArchive(list: List, all: List[]): boolean {
  if (list.state === 'archived') return true;
  const othersAlive = all.some(
    r => r.id !== list.id && (r.state === 'active' || r.state === 'pinned')
  );
  return othersAlive;
}

/** 校验清单名：trim 后非空 ≤ 20 字符。 */
export function validateListName(input: string): { ok: boolean; error?: string } {
  const v = input.trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > 20) return { ok: false, error: 'too-long' };
  return { ok: true };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/__tests__/list-sort.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/list-sort.ts src/lib/__tests__/list-sort.test.ts
git commit -m "feat(multi-list): sortLists/canArchive/validateListName pure helpers (TDD)"
```

---

## Task 5: `useLists` hook

**Files:** Create `src/hooks/useLists.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchListsByAccount } from '@/lib/db';
import { sortLists, type SortedLists } from '@/lib/list-sort';
import type { List } from '@/types/list';

/** 每清单的「待买件数」摘要。 */
export type ListSummary = Record<string, { unchecked: number }>;

interface UseListsReturn {
  groups: SortedLists;
  summaries: ListSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** 拉取账号下所有清单（含 archived）+ 批量预取「未勾选件数」。 */
export function useLists(accountId: string | null): UseListsReturn {
  const [groups, setGroups] = useState<SortedLists>({ pinned: [], active: [], archived: [] });
  const [summaries, setSummaries] = useState<ListSummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const rows = await fetchListsByAccount(accountId);
      setGroups(sortLists(rows));
      // batch items count: SELECT list_id, count(*) WHERE list_id IN (...) AND checked = false
      const ids = rows.map(r => r.id);
      if (ids.length === 0) { setSummaries({}); return; }
      const { data: items, error: e } = await supabase
        .from('items')
        .select('list_id, checked')
        .in('list_id', ids);
      if (e) throw e;
      const summary: ListSummary = {};
      for (const id of ids) summary[id] = { unchecked: 0 };
      for (const it of items ?? []) {
        if (!it.checked) summary[it.list_id].unchecked++;
      }
      setSummaries(summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  return { groups, summaries, loading, error, refresh: load };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLists.ts
git commit -m "feat(multi-list): useLists hook (fetch + sort + items-count summary)"
```

---

## Task 6: `useSwipeable` hook (TDD on threshold)

**Files:** Create `src/hooks/useSwipeable.ts`, `src/hooks/__tests__/useSwipeable.test.ts`

- [ ] **Step 1: Write failing test**

`src/hooks/__tests__/useSwipeable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeSwipeState } from '../useSwipeable';

describe('computeSwipeState', () => {
  const ACTION_PX = 126; // 3 buttons × 42px
  const COMMIT = ACTION_PX * 0.5; // threshold

  it('idle when deltaX = 0', () => {
    expect(computeSwipeState({ deltaX: 0, isOpen: false, actionWidth: ACTION_PX })).toEqual({
      offset: 0,
      shouldOpen: false,
    });
  });

  it('follows finger but caps at actionWidth', () => {
    expect(computeSwipeState({ deltaX: -50, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(-50);
    expect(computeSwipeState({ deltaX: -200, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(-ACTION_PX);
  });

  it('ignores rightward drag when closed', () => {
    expect(computeSwipeState({ deltaX: 30, isOpen: false, actionWidth: ACTION_PX }).offset).toBe(0);
  });

  it('shouldOpen=true if drag past threshold', () => {
    expect(computeSwipeState({ deltaX: -(COMMIT + 1), isOpen: false, actionWidth: ACTION_PX }).shouldOpen).toBe(true);
    expect(computeSwipeState({ deltaX: -(COMMIT - 1), isOpen: false, actionWidth: ACTION_PX }).shouldOpen).toBe(false);
  });

  it('when open, drag right > threshold closes', () => {
    const r = computeSwipeState({ deltaX: ACTION_PX * 0.6, isOpen: true, actionWidth: ACTION_PX });
    expect(r.shouldOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `npx vitest run src/hooks/__tests__/useSwipeable.test.ts`
Expected: FAIL — `Cannot find module '../useSwipeable'`.

- [ ] **Step 3: Implement**

```typescript
import { useRef, useState, useCallback } from 'react';

export interface SwipeStateInput {
  deltaX: number;
  isOpen: boolean;
  actionWidth: number;
}
export interface SwipeStateOutput {
  offset: number;       // negative = open-left
  shouldOpen: boolean;
}

/** 纯函数（便于单测）：把手指移动 + 当前开合状态映射成下一帧 offset + 是否锁住。 */
export function computeSwipeState({ deltaX, isOpen, actionWidth }: SwipeStateInput): SwipeStateOutput {
  if (!isOpen) {
    if (deltaX >= 0) return { offset: 0, shouldOpen: false };
    const offset = Math.max(deltaX, -actionWidth);
    return { offset, shouldOpen: -deltaX >= actionWidth * 0.5 };
  } else {
    // open: drag rightward to close
    if (deltaX <= 0) return { offset: -actionWidth, shouldOpen: true };
    const offset = Math.min(-actionWidth + deltaX, 0);
    return { offset, shouldOpen: deltaX < actionWidth * 0.5 };
  }
}

interface UseSwipeableOpts {
  actionWidth: number;  // px revealed when open
  onOpen?: () => void;
  onClose?: () => void;
}

/** 左滑暴露动作的小 hook。返回需绑到行容器的 handlers + style offset。 */
export function useSwipeable({ actionWidth, onOpen, onClose }: UseSwipeableOpts) {
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const close = useCallback(() => {
    setOffset(0);
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const open = useCallback(() => {
    setOffset(-actionWidth);
    setIsOpen(true);
    onOpen?.();
  }, [actionWidth, onOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    draggingRef.current = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || startXRef.current === null) return;
    const deltaX = e.clientX - startXRef.current;
    // tiny dead zone to avoid hijacking vertical scroll
    if (Math.abs(deltaX) < 6) return;
    const { offset: next } = computeSwipeState({ deltaX, isOpen, actionWidth });
    setOffset(next);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current || startXRef.current === null) { draggingRef.current = false; return; }
    const deltaX = e.clientX - startXRef.current;
    const { shouldOpen } = computeSwipeState({ deltaX, isOpen, actionWidth });
    if (shouldOpen) open(); else close();
    startXRef.current = null;
    draggingRef.current = false;
  };
  const onPointerCancel = onPointerUp;

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    offset,
    isOpen,
    close,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/hooks/__tests__/useSwipeable.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSwipeable.ts src/hooks/__tests__/useSwipeable.test.ts
git commit -m "feat(multi-list): useSwipeable hook + computeSwipeState (TDD)"
```

---

## Task 7: Watercolor placeholder icons

**Files:** Create `src/components/ListSwitcherIcon.tsx`, `src/components/PaperPlaneIcon.tsx`

- [ ] **Step 1: ListSwitcherIcon (一叠卡片占位)**

```tsx
interface Props { size?: number; className?: string; }

/** 占位 SVG — 用户后续替换为手绘水彩版本。 */
export function ListSwitcherIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="6" width="14" height="11" rx="2"
        stroke="#c89377" strokeWidth="1.8" fill="#fbe6db" strokeLinejoin="round" />
      <rect x="6" y="3" width="14" height="11" rx="2"
        stroke="#c89377" strokeWidth="1.8" fill="#faf6f0" strokeLinejoin="round" />
      <line x1="9" y1="7" x2="16" y2="7" stroke="#c89377" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="10" x2="14" y2="10" stroke="#c89377" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: PaperPlaneIcon (纸飞机占位)**

```tsx
interface Props { size?: number; className?: string; }

/** 占位 SVG — 用户后续替换为手绘水彩版本。 */
export function PaperPlaneIcon({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12 L21 4 L17 21 L11 14 L3 12 Z"
        fill="#fbe6db" stroke="#c89377" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11 14 L21 4" stroke="#c89377" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Typecheck** → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListSwitcherIcon.tsx src/components/PaperPlaneIcon.tsx
git commit -m "feat(multi-list): placeholder watercolor SVGs (switcher + paper plane)"
```

---

## Task 8: Extract `<StorePicker>` from Onboarding

**Files:** Create `src/components/StorePicker.tsx`, Modify `src/routes/Onboarding.tsx`

- [ ] **Step 1: Read** `src/routes/Onboarding.tsx` to locate the stores section (find the JSX block that renders `addedStores.map(...)` + input + `addStore`/`removeStore`).

- [ ] **Step 2: Create `<StorePicker>`** (extracted, no behavior change)

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Store } from '@/types/store';

interface Props {
  stores: Store[];
  onChange: (next: Store[]) => void;
  placeholder?: string;
}

/** 店铺名 chips：输入名称→加 chip，点 chip 上的 × 移除。沿用 Onboarding step 2 视觉。 */
export function StorePicker({ stores, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const add = () => {
    const name = input.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (stores.some(s => s.id === id)) { setInput(''); return; }
    onChange([...stores, { id, name }]);
    setInput('');
  };
  const remove = (i: number) => onChange(stores.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {stores.map((s, i) => (
          <span
            key={s.id}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(232,174,151,.16)',
              border: '1px solid rgba(232,174,151,.45)',
              color: '#5a4e3c',
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {s.name}
            <button
              onClick={() => remove(i)}
              aria-label={t('storePicker.remove') || 'remove'}
              style={{ background: 'none', border: 'none', color: '#a0937e', cursor: 'pointer', padding: 0, fontSize: 14 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder ?? t('storePicker.placeholder') ?? '店铺名'}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(255,253,249,.8)',
            border: '1px solid rgba(215,205,188,.5)',
            color: '#5a4e3c',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={add}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(232,174,151,.18)',
            border: '1px solid rgba(232,174,151,.45)',
            color: '#5a4e3c',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {t('storePicker.add') ?? '加入'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Refactor Onboarding step 2** — replace the inline chips JSX with `<StorePicker stores={addedStores} onChange={setAddedStores} />`. Remove `newStoreName` / `setNewStoreName` / `addStore` / `removeStore` from Onboarding (now inside the component).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (no behavior regression in onboarding).

- [ ] **Step 5: Commit**

```bash
git add src/components/StorePicker.tsx src/routes/Onboarding.tsx
git commit -m "refactor(stores): extract StorePicker from Onboarding (for NewListSheet reuse)"
```

---

## Task 9: `<NewListSheet>` half-sheet form

**Files:** Create `src/components/NewListSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StorePicker } from '@/components/StorePicker';
import { validateListName } from '@/lib/list-sort';
import { DEFAULT_STORES } from '@/utils/constants';
import type { Store } from '@/types/store';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, stores: Store[]) => Promise<void>;
}

export function NewListSheet({ open, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName(''); setStores([]); setErr(null); setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const validation = validateListName(name);
  const submit = async () => {
    if (!validation.ok) { setErr(validation.error ?? 'invalid'); return; }
    setSubmitting(true);
    try {
      const finalStores = stores.length > 0 ? stores : DEFAULT_STORES;
      await onSubmit(name.trim(), finalStores);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(60,50,40,.28)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        background: '#fbf7f1',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 28px',
        boxShadow: '0 -8px 24px rgba(90,78,60,.18)',
      }}>
        <div style={{ width: 36, height: 4, background: '#cdbfa9', borderRadius: 2, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#5a4e3c', margin: '4px 0 16px' }}>
          {t('newList.title')}
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: '#a0937e', marginBottom: 6 }}>
          {t('newList.nameLabel')}
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('newList.namePlaceholder') ?? ''}
          maxLength={20}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,253,249,.9)',
            border: '1px solid rgba(215,205,188,.5)',
            color: '#5a4e3c',
            fontSize: 16,
            outline: 'none',
            marginBottom: 16,
          }}
        />
        <label style={{ display: 'block', fontSize: 12, color: '#a0937e', marginBottom: 6 }}>
          {t('newList.storesLabel')}
        </label>
        <StorePicker stores={stores} onChange={setStores} />
        {err && (
          <p style={{ color: '#b06a5a', fontSize: 13, marginTop: 12 }}>
            {err === 'empty' ? t('newList.errEmpty')
             : err === 'too-long' ? t('newList.errTooLong')
             : err}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'none', border: '1px solid rgba(215,205,188,.6)', color: '#8a7a64', fontSize: 15 }}
          >
            {t('newList.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !validation.ok}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none',
              background: validation.ok ? 'rgba(124,169,130,.22)' : 'rgba(215,205,188,.3)',
              color: validation.ok ? '#5b8a64' : '#a0937e',
              fontSize: 15, fontWeight: 600,
            }}
          >
            {submitting ? t('newList.creating') : t('newList.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** → 0 errors. (`DEFAULT_STORES` import will resolve from `src/utils/constants.ts` — verify in step.)

- [ ] **Step 3: Commit**

```bash
git add src/components/NewListSheet.tsx
git commit -m "feat(multi-list): NewListSheet (half-sheet form, reuses StorePicker)"
```

---

## Task 10: `<ListActionSheet>` long-press menu

**Files:** Create `src/components/ListActionSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useTranslation } from 'react-i18next';
import type { List } from '@/types/list';

export type ListAction = 'rename' | 'togglePin' | 'share' | 'archive' | 'delete';

interface Props {
  open: boolean;
  list: List | null;
  canDelete: boolean;       // false = greyed (last active)
  canArchive: boolean;      // false = greyed
  onClose: () => void;
  onPick: (action: ListAction) => void;
}

export function ListActionSheet({ open, list, canDelete, canArchive, onClose, onPick }: Props) {
  const { t } = useTranslation();
  if (!open || !list) return null;

  const items: Array<{ key: ListAction; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: 'rename', label: t('listActions.rename') },
    { key: 'togglePin', label: list.state === 'pinned' ? t('listActions.unpin') : t('listActions.pin') },
    { key: 'share', label: t('listActions.share') },
    { key: 'archive', label: list.state === 'archived' ? t('listActions.unarchive') : t('listActions.archive'), disabled: !canArchive && list.state !== 'archived' },
    { key: 'delete', label: t('listActions.delete'), danger: true, disabled: !canDelete },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(60,50,40,.28)' }} />
      <div style={{
        position: 'relative',
        width: '100%',
        background: '#fbf7f1',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 24px',
        boxShadow: '0 -8px 24px rgba(90,78,60,.18)',
      }}>
        <div style={{ width: 36, height: 4, background: '#cdbfa9', borderRadius: 2, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13, color: '#a0937e', textAlign: 'center', marginBottom: 6 }}>{list.name}</div>
        {items.map((it, i) => (
          <button
            key={it.key}
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) onPick(it.key); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 4px',
              background: 'none',
              border: 'none',
              borderTop: i > 0 ? '1px solid rgba(215,205,188,.4)' : 'none',
              textAlign: 'left',
              fontSize: 15,
              fontWeight: 500,
              color: it.disabled ? '#bcae98' : it.danger ? '#b06a5a' : '#5a4e3c',
              cursor: it.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListActionSheet.tsx
git commit -m "feat(multi-list): ListActionSheet long-press menu"
```

---

## Task 11: `<ListRow>` (swipe + long-press + tap)

**Files:** Create `src/components/ListRow.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useLongPress } from '@/hooks/useLongPress';
import { useSwipeable } from '@/hooks/useSwipeable';
import { useTranslation } from 'react-i18next';
import type { List } from '@/types/list';

interface Props {
  list: List;
  isCurrent: boolean;
  summary?: string;           // e.g. "8 件待买 · 山姆"
  canArchive: boolean;
  canDelete: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onSwipeAction: (action: 'togglePin' | 'archive' | 'delete') => void;
}

const ACTION_W = 126; // 3 × 42

export function ListRow({ list, isCurrent, summary, canArchive, canDelete, onTap, onLongPress, onSwipeAction }: Props) {
  const { t } = useTranslation();
  const { handlers, offset, isOpen, close } = useSwipeable({ actionWidth: ACTION_W });
  const lp = useLongPress(() => { if (!isOpen) onLongPress(); });

  const handleTap = (e: React.MouseEvent) => {
    if (isOpen) { e.preventDefault(); close(); return; }
    if (lp.isLongPressed) { e.preventDefault(); return; }
    onTap();
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, margin: '0 12px 6px' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => onSwipeAction('togglePin')} style={swipeBtnStyle('#d6a06f')}>
          {list.state === 'pinned' ? t('listActions.unpin') : t('listActions.pin')}
        </button>
        <button onClick={() => canArchive && onSwipeAction('archive')} disabled={!canArchive} style={swipeBtnStyle('#b1a18a', !canArchive)}>
          {t('listActions.archive')}
        </button>
        <button onClick={() => canDelete && onSwipeAction('delete')} disabled={!canDelete} style={swipeBtnStyle('#b06a5a', !canDelete)}>
          {t('listActions.delete')}
        </button>
      </div>
      <div
        {...handlers}
        {...lp.handlers}
        onClick={handleTap}
        style={{
          position: 'relative',
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || offset === -ACTION_W ? 'transform .22s ease' : 'none',
          padding: '11px 14px',
          background: isCurrent ? 'rgba(232,174,151,.10)' : '#fffdf9',
          border: `1px solid ${isCurrent ? 'rgba(232,174,151,.55)' : 'rgba(215,205,188,.5)'}`,
          borderRadius: 12,
          cursor: 'pointer',
          touchAction: 'pan-y',
        }}
      >
        {isCurrent && (
          <div style={{ position: 'absolute', left: 0, top: 11, bottom: 11, width: 3, borderRadius: '0 3px 3px 0', background: '#e8ae97' }} />
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#5a4e3c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{list.name}</span>
          {isCurrent && (
            <span style={{ fontSize: 10, color: '#c0805f', background: 'rgba(232,174,151,.22)', padding: '1px 7px', borderRadius: 8, fontWeight: 600 }}>
              {t('myLists.currentTag')}
            </span>
          )}
        </div>
        {summary && <div style={{ fontSize: 11, color: '#a0937e', marginTop: 3 }}>{summary}</div>}
      </div>
    </div>
  );
}

function swipeBtnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    width: 42,
    background: disabled ? '#d0c4b1' : bg,
    color: '#fffdf9',
    border: 'none',
    fontSize: 10,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .55 : 1,
  };
}
```

- [ ] **Step 2: Typecheck** → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListRow.tsx
git commit -m "feat(multi-list): ListRow (swipe + long-press + tap, [当前] badge)"
```

---

## Task 12: `<MyLists>` route (B 视图)

**Files:** Create `src/routes/MyLists.tsx`

- [ ] **Step 1: Write the route**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useLists } from '@/hooks/useLists';
import { ListRow } from '@/components/ListRow';
import { ListActionSheet, type ListAction } from '@/components/ListActionSheet';
import { NewListSheet } from '@/components/NewListSheet';
import { canArchive as canArchiveFn } from '@/lib/list-sort';
import {
  createList, renameList, setListState, deleteList, fetchListsByAccount
} from '@/lib/db';
import { findAccountForUid } from '@/lib/account';
import { persistActiveList, getStoredListId } from '@/lib/active-list';
import { joinList } from '@/lib/db';
import type { List } from '@/types/list';
import type { Store } from '@/types/store';

const ARCHIVE_FOLD_KEY = 'maisha:archive-expanded';

export default function MyLists() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [currentListId, setCurrentListId] = useState<string | null>(getStoredListId());
  const { groups, summaries, loading, refresh } = useLists(accountId);
  const allLists: List[] = [...groups.pinned, ...groups.active, ...groups.archived];

  const [archiveOpen, setArchiveOpen] = useState<boolean>(
    localStorage.getItem(ARCHIVE_FOLD_KEY) === '1'
  );
  const [actionTarget, setActionTarget] = useState<List | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    findAccountForUid(uid).then(a => setAccountId(a?.id ?? null));
  }, [uid]);

  const toggleArchiveFold = () => {
    const next = !archiveOpen;
    setArchiveOpen(next);
    localStorage.setItem(ARCHIVE_FOLD_KEY, next ? '1' : '0');
  };

  const onTap = async (list: List) => {
    if (!uid) return;
    // persist + nav
    const account = await findAccountForUid(uid);
    if (account) await persistActiveList(account, list);
    setCurrentListId(list.id);
    nav('/list');
  };

  const onSwipeAction = async (list: List, action: 'togglePin' | 'archive' | 'delete') => {
    try {
      if (action === 'togglePin') {
        const next = list.state === 'pinned' ? 'active' : 'pinned';
        await setListState(list.id, next, next === 'pinned' ? 0 : null);
      } else if (action === 'archive') {
        await setListState(list.id, 'archived');
      } else if (action === 'delete') {
        // two-tap confirm
        if (pendingDelete !== list.id) {
          setPendingDelete(list.id);
          setTimeout(() => setPendingDelete(null), 3000);
          return;
        }
        await deleteList(list.id);
        setPendingDelete(null);
        if (currentListId === list.id) {
          // bootstrap will fallback on next mount; clear stored pointer
          localStorage.removeItem('maisha:list-id');
        }
      }
      await refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const onActionPick = async (action: ListAction) => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionTarget(null);
    try {
      if (action === 'rename') {
        const next = prompt(t('listActions.renamePrompt') ?? 'Rename to:', target.name);
        if (next && next.trim() && next.trim() !== target.name) {
          await renameList(target.id, next.trim());
        }
      } else if (action === 'togglePin') {
        const next = target.state === 'pinned' ? 'active' : 'pinned';
        await setListState(target.id, next, next === 'pinned' ? 0 : null);
      } else if (action === 'share') {
        const text = target.short_code
          ? `${t('listActions.inviteCode')}：${target.short_code}\n${location.origin}/list?list=${target.id}`
          : `${location.origin}/list?list=${target.id}`;
        try { await navigator.clipboard.writeText(text); alert(t('listActions.shareCopied')); }
        catch { prompt(t('listActions.shareCopy') ?? '复制：', text); }
      } else if (action === 'archive') {
        await setListState(target.id, target.state === 'archived' ? 'active' : 'archived');
      } else if (action === 'delete') {
        if (confirm(t('listActions.confirmDelete', { name: target.name }) ?? `Delete ${target.name}?`)) {
          await deleteList(target.id);
        }
      }
      await refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const onCreate = async (name: string, stores: Store[]) => {
    if (!uid || !accountId) return;
    const created = await createList(accountId, uid, name, stores);
    const account = await findAccountForUid(uid);
    if (account) await persistActiveList(account, created);
    setCurrentListId(created.id);
    setShowNew(false);
    nav('/list');
  };

  const renderRow = (list: List) => {
    const sum = summaries[list.id];
    const summary = sum
      ? sum.unchecked > 0
        ? t('myLists.uncheckedCount', { n: sum.unchecked })
        : t('myLists.empty')
      : undefined;
    return (
      <ListRow
        key={list.id}
        list={list}
        isCurrent={list.id === currentListId}
        summary={summary}
        canArchive={canArchiveFn(list, allLists)}
        canDelete={canArchiveFn(list, allLists)}  // same guardrail
        onTap={() => onTap(list)}
        onLongPress={() => setActionTarget(list)}
        onSwipeAction={(a) => onSwipeAction(list, a)}
      />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav('/list')} aria-label="back" style={{ background: 'none', border: 'none', fontSize: 22, color: '#8a7a64', cursor: 'pointer', padding: 4 }}>
          ←
        </button>
        <span style={{ flex: 1, fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)', letterSpacing: 2 }}>
          {t('myLists.title')}
        </span>
        <button
          onClick={() => setShowNew(true)}
          aria-label={t('newList.title')}
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(124,169,130,.15)', border: '1px solid rgba(124,169,130,.4)',
            color: '#5b8a64', fontSize: 18, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >＋</button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#a0937e', fontSize: 13, padding: 32 }}>{t('common.loading')}</p>
      ) : (
        <>
          {groups.pinned.length > 0 && (
            <>
              <h3 style={sectionHeaderStyle}>{t('myLists.sectionPinned')}</h3>
              {groups.pinned.map(renderRow)}
            </>
          )}
          {groups.active.length > 0 && (
            <>
              <h3 style={sectionHeaderStyle}>{t('myLists.sectionActive')}</h3>
              {groups.active.map(renderRow)}
            </>
          )}
          {groups.archived.length > 0 && (
            <>
              <button onClick={toggleArchiveFold} style={{ ...sectionHeaderStyle, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('myLists.sectionArchived', { n: groups.archived.length })}
                <span style={{ fontSize: 9 }}>{archiveOpen ? '▾' : '▸'}</span>
              </button>
              {archiveOpen && groups.archived.map(renderRow)}
            </>
          )}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => nav('/all-lists')}
              style={{ background: 'none', border: 'none', color: '#7ca982', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('myLists.seeAll', { n: allLists.length })} →
            </button>
          </div>
        </>
      )}

      <ListActionSheet
        open={!!actionTarget}
        list={actionTarget}
        canArchive={actionTarget ? canArchiveFn(actionTarget, allLists) : true}
        canDelete={actionTarget ? canArchiveFn(actionTarget, allLists) : true}
        onClose={() => setActionTarget(null)}
        onPick={onActionPick}
      />
      <NewListSheet open={showNew} onClose={() => setShowNew(false)} onSubmit={onCreate} />
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '14px 16px 6px', fontWeight: 400, textTransform: 'uppercase',
};
```

- [ ] **Step 2: Typecheck** → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/MyLists.tsx
git commit -m "feat(multi-list): MyLists route (B view, grouped sections, action wiring)"
```

---

## Task 13: `<AllLists>` route (A 视图)

**Files:** Create `src/routes/AllLists.tsx`

- [ ] **Step 1: Write the route**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useLists } from '@/hooks/useLists';
import { findAccountForUid } from '@/lib/account';
import { persistActiveList } from '@/lib/active-list';
import type { List } from '@/types/list';

export default function AllLists() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const [accountId, setAccountId] = useState<string | null>(null);
  const { groups, summaries, loading } = useLists(accountId);
  const live = [...groups.pinned, ...groups.active];
  const total = live.length + groups.archived.length;

  useEffect(() => {
    if (!uid) return;
    findAccountForUid(uid).then(a => setAccountId(a?.id ?? null));
  }, [uid]);

  const onTap = async (list: List) => {
    if (!uid) return;
    const account = await findAccountForUid(uid);
    if (account) await persistActiveList(account, list);
    nav('/list');
  };

  const renderCard = (list: List, archived: boolean, idx: number) => {
    const sum = summaries[list.id];
    const summary = sum && sum.unchecked > 0 ? t('myLists.uncheckedCount', { n: sum.unchecked })
      : archived ? t('allLists.done') : t('myLists.empty');
    return (
      <button
        key={list.id}
        onClick={() => onTap(list)}
        style={{
          width: 'calc(33.33% - 7px)',
          background: archived ? '#f4efe8' : '#fffdf9',
          color: archived ? '#ab9f93' : '#5a4e3c',
          border: '1px solid rgba(215,205,188,.5)',
          borderRadius: 12,
          padding: '8px 9px',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          animation: `mlBounceIn .6s cubic-bezier(.34,1.56,.64,1) backwards`,
          animationDelay: `${idx * 60}ms`,
        }}
      >
        {list.name}
        <small style={{ display: 'block', fontWeight: 400, color: archived ? '#b9ad9f' : '#a0937e', fontSize: 9, marginTop: 4 }}>
          {summary}
        </small>
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingBottom: 24 }}>
      <style>{`@keyframes mlBounceIn { 0%{transform:translateY(15px) scale(.6);opacity:0;} 70%{transform:translateY(-3px) scale(1.04);opacity:1;} 100%{transform:translateY(0) scale(1);opacity:1;} }`}</style>
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => nav('/my-lists')} aria-label="back" style={{ background: 'none', border: 'none', fontSize: 22, color: '#8a7a64', cursor: 'pointer', padding: 4 }}>←</button>
        <span style={{ flex: 1, fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--ink)', letterSpacing: 2 }}>{t('allLists.title')}</span>
        <span style={{ color: '#a0937e', fontSize: 13 }}>{total}</span>
      </div>

      {loading ? <p style={{ textAlign: 'center', color: '#a0937e', fontSize: 13, padding: 32 }}>{t('common.loading')}</p> : (
        <>
          {live.length > 0 && (
            <>
              <h3 style={{ fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '14px 16px 8px' }}>{t('allLists.sectionLive')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 14px' }}>
                {live.map((l, i) => renderCard(l, false, i))}
              </div>
            </>
          )}
          {groups.archived.length > 0 && (
            <>
              <h3 style={{ fontSize: 10, color: '#a0937e', letterSpacing: 2, margin: '18px 16px 8px' }}>{t('allLists.sectionArchived')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 14px' }}>
                {groups.archived.map((l, i) => renderCard(l, true, live.length + i))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/AllLists.tsx
git commit -m "feat(multi-list): AllLists route (A view, 3-col grid + Bounce-in)"
```

---

## Task 14: `List.tsx` header rewrite

**Files:** Modify `src/routes/List.tsx`

- [ ] **Step 1: Replace header block** — locate the `{/* Header */}` block (~lines 158-197) and swap title + buttons.

Imports (add near existing imports, ~line 14):
```tsx
import { ListSwitcherIcon } from '@/components/ListSwitcherIcon';
import { PaperPlaneIcon } from '@/components/PaperPlaneIcon';
```

Replace the header `<div>` (`padding: '16px 24px 12px'` … through the closing `</div>` before the dashed divider) with:

```tsx
        <div style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t('settings.title')}
            style={{
              fontSize: 22, color: 'var(--ink-light)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 4, lineHeight: 1, marginLeft: -4,
            }}
          >≡</button>
          <span style={{
            fontFamily: 'var(--font-title)',
            fontSize: 24,
            color: 'var(--ink)',
            letterSpacing: 1,
            flex: 1,
            paddingLeft: 4,
          }}>
            {list.name}
          </span>
          <button
            onClick={() => nav('/my-lists')}
            aria-label={t('myLists.title')}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(232,174,151,.13)', border: '1px solid rgba(232,174,151,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 4,
            }}
          >
            <ListSwitcherIcon size={22} />
          </button>
          <button
            onClick={onShareMenu}
            aria-label={t('header.joinList')}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'rgba(232,174,151,.13)', border: '1px solid rgba(232,174,151,.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 4,
            }}
          >
            <PaperPlaneIcon size={22} />
          </button>
        </div>
```

- [ ] **Step 2: Typecheck + vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, 110 tests PASS (104 existing + 6 from list-sort).

- [ ] **Step 3: Commit**

```bash
git add src/routes/List.tsx
git commit -m "feat(multi-list): rewrite List header (list.name title + 2 watercolor icon buttons)"
```

---

## Task 15: `App.tsx` add routes

**Files:** Modify `src/App.tsx`

- [ ] **Step 1: Add imports + routes** (after existing imports + `Route` lines)

```tsx
import MyLists from './routes/MyLists';
import AllLists from './routes/AllLists';
```

Inside the inner `<Routes>` block (alongside other authed routes), add before the catch-all:
```tsx
        <Route path="/my-lists" element={<MyLists />} />
        <Route path="/all-lists" element={<AllLists />} />
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(multi-list): route /my-lists and /all-lists"
```

---

## Task 16: i18n strings

**Files:** Modify `src/locales/zh-CN.json`, `src/locales/zh-TW.json`, `src/locales/en.json`

- [ ] **Step 1: Add keys to `zh-CN.json`** (merge into existing JSON; insert as top-level or under appropriate nesting)

```json
{
  "myLists": {
    "title": "我的清单",
    "sectionPinned": "固定",
    "sectionActive": "进行中",
    "sectionArchived": "已归档 ({{n}})",
    "currentTag": "当前",
    "uncheckedCount": "{{n}} 件待买",
    "empty": "无待买",
    "seeAll": "查看全部 {{n}} 个"
  },
  "allLists": {
    "title": "全部清单",
    "sectionLive": "固定 · 进行中",
    "sectionArchived": "已归档",
    "done": "已完成"
  },
  "newList": {
    "title": "新建清单",
    "nameLabel": "名称",
    "namePlaceholder": "起个名字",
    "storesLabel": "起始超市（可选）",
    "cancel": "取消",
    "create": "创建",
    "creating": "创建中…",
    "errEmpty": "名称不能为空",
    "errTooLong": "名称过长（≤ 20 字）"
  },
  "listActions": {
    "rename": "重命名",
    "renamePrompt": "改名为：",
    "pin": "置顶",
    "unpin": "取消置顶",
    "share": "分享链接 / 邀请码",
    "shareCopied": "已复制邀请",
    "shareCopy": "复制：",
    "inviteCode": "邀请码",
    "archive": "归档",
    "unarchive": "恢复",
    "delete": "删除",
    "confirmDelete": "确定删除清单「{{name}}」？此操作不可撤销。"
  },
  "storePicker": {
    "placeholder": "店铺名",
    "add": "加入",
    "remove": "移除"
  },
  "common": {
    "loading": "加载中…"
  }
}
```

(Merge — do NOT replace the existing JSON; insert these keys alongside the existing top-level groups.)

- [ ] **Step 2: Mirror to `zh-TW.json` (繁體中文)**

```json
{
  "myLists": {
    "title": "我的清單",
    "sectionPinned": "固定",
    "sectionActive": "進行中",
    "sectionArchived": "已封存 ({{n}})",
    "currentTag": "目前",
    "uncheckedCount": "{{n}} 項待買",
    "empty": "無待買",
    "seeAll": "檢視全部 {{n}} 個"
  },
  "allLists": {
    "title": "全部清單",
    "sectionLive": "固定 · 進行中",
    "sectionArchived": "已封存",
    "done": "已完成"
  },
  "newList": {
    "title": "新增清單",
    "nameLabel": "名稱",
    "namePlaceholder": "起個名字",
    "storesLabel": "起始商店（選填）",
    "cancel": "取消",
    "create": "建立",
    "creating": "建立中…",
    "errEmpty": "名稱不能為空",
    "errTooLong": "名稱過長（≤ 20 字）"
  },
  "listActions": {
    "rename": "重新命名",
    "renamePrompt": "改名為：",
    "pin": "釘選",
    "unpin": "取消釘選",
    "share": "分享連結 / 邀請碼",
    "shareCopied": "已複製邀請",
    "shareCopy": "複製：",
    "inviteCode": "邀請碼",
    "archive": "封存",
    "unarchive": "復原",
    "delete": "刪除",
    "confirmDelete": "確定刪除清單「{{name}}」？此操作無法復原。"
  },
  "storePicker": {
    "placeholder": "商店名",
    "add": "加入",
    "remove": "移除"
  },
  "common": {
    "loading": "載入中…"
  }
}
```

- [ ] **Step 3: Mirror to `en.json`**

```json
{
  "myLists": {
    "title": "My Lists",
    "sectionPinned": "Pinned",
    "sectionActive": "Active",
    "sectionArchived": "Archived ({{n}})",
    "currentTag": "current",
    "uncheckedCount": "{{n}} to buy",
    "empty": "Empty",
    "seeAll": "See all {{n}}"
  },
  "allLists": {
    "title": "All Lists",
    "sectionLive": "Pinned · Active",
    "sectionArchived": "Archived",
    "done": "Done"
  },
  "newList": {
    "title": "New List",
    "nameLabel": "Name",
    "namePlaceholder": "Give it a name",
    "storesLabel": "Starting stores (optional)",
    "cancel": "Cancel",
    "create": "Create",
    "creating": "Creating…",
    "errEmpty": "Name cannot be empty",
    "errTooLong": "Name too long (≤ 20 chars)"
  },
  "listActions": {
    "rename": "Rename",
    "renamePrompt": "Rename to:",
    "pin": "Pin",
    "unpin": "Unpin",
    "share": "Share / Invite code",
    "shareCopied": "Invite copied",
    "shareCopy": "Copy:",
    "inviteCode": "Invite code",
    "archive": "Archive",
    "unarchive": "Unarchive",
    "delete": "Delete",
    "confirmDelete": "Delete list \"{{name}}\"? This cannot be undone."
  },
  "storePicker": {
    "placeholder": "Store name",
    "add": "Add",
    "remove": "Remove"
  },
  "common": {
    "loading": "Loading…"
  }
}
```

- [ ] **Step 4: Typecheck + run all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/locales/zh-CN.json src/locales/zh-TW.json src/locales/en.json
git commit -m "feat(multi-list): i18n strings (zh-CN, zh-TW, en)"
```

---

## Task 17: Full verify + migration handoff + browser smoke

- [ ] **Step 1: Full local verify**

Run:
```
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: tests PASS (110+: existing 99 + 11 new from list-sort + useSwipeable); 0 type errors; build succeeds.

- [ ] **Step 2: HANDOFF — apply migration 012 (user action)**

Paste `supabase/migrations/012_multi_list.sql` into Supabase Studio SQL Editor and run, OR `npx supabase db push` if linked. (Per [[multi-list-idea]] note: 010/011 went via SQL Editor, easiest path.)

Verify in Studio:
- `\d lists` → shows `state` text NOT NULL, `pin_order` integer
- `SELECT name, state FROM lists` → existing 「家里」 rows show `state='pinned'`
- `SELECT * FROM pg_proc WHERE proname IN ('set_list_state','delete_list')` → both exist

- [ ] **Step 3: Browser smoke** (per spec §「验证 / 自测要点」)

1. Reload PWA (or dev server) — current list still loads, title shows list name, paper-plane replaces 邀请 text ✓
2. Tap switcher icon → `/my-lists` opens with smooth fade-in, 「家里」 has orange left-bar + [当前] tag ✓
3. ＋ → 「测试 2」 → submit → auto-switches to 测试 2, returns to `/list` ✓
4. Back to `/my-lists` → left-swipe 测试 2 → reveal 3 buttons; tap 置顶 → moves to Pinned section ✓
5. Long-press 测试 2 → action sheet → 重命名 → 测试 → list updates ✓
6. Long-press 测试 → 归档 → moves to Archived (folded) → click ▸ to expand ✓
7. In archived, long-press 测试 → 删除 → confirm dialog → row removed ✓
8. Switch current to 测试 (still active) → from `/my-lists`, swipe 测试 → 删除 → confirm → row gone, auto-fallback to 家里 ✓
9. With only 家里 left, swipe → archive/delete buttons greyed; DB also rejects if you try ✓
10. 「查看全部」 → `/all-lists` → bounce-in animation, 3-col grid ✓
11. Share a list (long-press → 分享链接) on a non-current row → invite text copied with that list's short_code ✓

- [ ] **Step 4: Final commit (none required) + push**

```bash
git push origin main
```

- [ ] **Step 5: Update memory** — add a note to [[multi-list-idea]] memory: "v1 multi-list UX SHIPPED 2026-06-04, migration 012 applied, smoke passed".

---

## Self-Review

**Spec coverage:**
- §1 形态定位 → Task 1 (state enum), Task 12/13 (3 sections) ✓
- §2 导航分层 → Task 12 (B), Task 13 (A), Task 14 (header) ✓
- §3 头部组合 → Task 7 (icons), Task 14 (List header) ✓
- §4 B 视图 → Task 12; summary line via Task 5 (useLists) ✓
- §5 A 视图 → Task 13 (Bounce stagger via animation-delay) ✓
- §6 操作 → Task 6 (useSwipeable), Task 10 (sheet), Task 11 (ListRow wiring), Task 9 (NewListSheet) ✓
- §7 数据 → Task 1 (migration), Task 2 (types), Task 3 (db.ts), Task 4 (canArchive), Task 5 (useLists) ✓
- §8 文件清单 → covered 1-1 by Tasks 1-16 ✓
- §9 验证要点 → Task 17 covers all 11 smoke items ✓
- §10 推后项 → none implemented ✓

**Placeholder scan:** no TBD/TODO; all code blocks complete; no "similar to Task N".

**Type consistency:**
- `List` shape: defined Task 2, used Task 3/5/9/10/11/12/13 — all reference `list.state`, `list.pin_order`, `list.name`, `list.short_code`. ✓
- `ListAction` type: defined Task 10, consumed Task 12. ✓
- `SortedLists` / `ListSummary`: defined Task 4 / 5, used Task 5 / 12. ✓
- `canArchive(list, all)` signature consistent across Task 4 def and Task 11/12 use. ✓
- `createList(accountId, uid, name, stores)` / `setListState(id, state, pinOrder?)` / `deleteList(id)` / `renameList(id, name)`: defined Task 3, called consistently in Task 12. ✓
- `useSwipeable({ actionWidth, onOpen?, onClose? })` returning `{handlers, offset, isOpen, close}`: defined Task 6, used Task 11. ✓
