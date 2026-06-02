# Account-Scoped Icon Library — v1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move custom icons from per-list to per-account so they follow the person (cross-device, cross-list, never lost), with same-name family reuse via a union — without changing any icon-map *consumer*.

**Architecture:** One DB migration (`010`) renames `custom_icons → icon_library` (account-scoped), backfills `account_id`, creates the (empty-in-v1) `list_icon_assignments` table, and adds a `get_list_icon_map(list_id)` RPC returning the union of all list members' accounts' libraries. The client hook `useCustomIcons` switches to that RPC; the map is built by a pure `buildIconMap()` (library rows: `created_at`-earliest wins; assignment rows override; keys normalized via `normalizeName()` for simp/trad). The Edge Function moves quota to per-account with a graduated soft gate. `IconLibrary` switches to a new account-scoped `useMyLibrary`. Reuse-selector + library polish are **out of scope** (v1.1, FE-only, table already built here).

**Tech Stack:** React 18 + Vite + TypeScript, Supabase (Postgres + RLS + Edge Functions/Deno), vitest (pure-logic unit tests, `vitest run`).

**Scope boundary (what this plan does NOT do):** writing `list_icon_assignments` (reuse selector / replace flow = v1.1), realtime sync (v2). The table + RPC read-path for assignments are built now so v1.1 needs no migration.

**Verification reality:** Pure units (`normalizeName`, `buildIconMap`, `resolveIconUrl`/`getIconPath`) are TDD'd with vitest. Supabase I/O (lib, hooks, components, migration SQL, Edge Function) is verified by `tsc` typecheck + `vitest run` + `vite build`. **Applying migration 010 to the live DB and deploying the Edge Function require live credentials and are HANDED OFF to the user (Task 11), gated behind the read-only audit.**

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/utils/normalize-name.ts` | Create | `normalizeName()` — trim + drop whitespace + trad→simp via a hand-maintained char table |
| `src/utils/__tests__/normalize-name.test.ts` | Create | Unit tests for normalization |
| `src/utils/icon-registry.ts` | Modify | `getIconPath` + `resolveIconUrl` match via `normalizeName` (call sites unchanged) |
| `src/utils/__tests__/icon-registry.test.ts` | Create | Tests for normalized preset matching |
| `src/lib/icon-map.ts` | Create | Pure `buildIconMap(rows, urlFor)` — union priority (created_at-earliest) + assignment override + normalized keys |
| `src/lib/__tests__/icon-map.test.ts` | Create | Unit tests for map-building priority |
| `src/lib/custom-icons.ts` | Rewrite | Account-scoped data layer (RPC fetch, account CRUD, account quota); keeps file path + exported names to avoid import churn |
| `src/hooks/useCustomIcons.ts` | Modify | Call `get_list_icon_map` RPC + `buildIconMap`; same return shape |
| `src/hooks/useMyLibrary.ts` | Create | Account-scoped "my icons" for the management page |
| `src/routes/IconLibrary.tsx` | Modify | Use `useMyLibrary(account_id)`; pass `accountId` to `NewIconSheet` |
| `src/components/NewIconSheet.tsx` | Modify | Add `accountId` prop; account-based upload + credits |
| `supabase/migrations/010_account_icon_library.sql` | Create | The migration (rename, backfill, dedup, assignments table, RPC, RLS, GIN, log cols, storage policies) |
| `supabase/functions/generate-icon/index.ts` | Rewrite | Account quota + graduated gate + write `icon_library` + `{account_id}` path + log account_id/ip |

---

## Task 1: `normalizeName()` simp/trad util (TDD)

**Files:**
- Create: `src/utils/normalize-name.ts`
- Test: `src/utils/__tests__/normalize-name.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/__tests__/normalize-name.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeName } from '../normalize-name';

describe('normalizeName', () => {
  it('strips surrounding whitespace and inner spaces', () => {
    expect(normalizeName('  生 抽 ')).toBe('生抽');
  });
  it('maps traditional chars to simplified (酱油)', () => {
    expect(normalizeName('醬油')).toBe(normalizeName('酱油'));
  });
  it('maps 椰漿 to match 椰浆', () => {
    expect(normalizeName('椰漿')).toBe('椰浆');
  });
  it('maps 雞蛋 to match 鸡蛋', () => {
    expect(normalizeName('雞蛋')).toBe('鸡蛋');
  });
  it('maps 蘿蔔 to match 萝卜', () => {
    expect(normalizeName('蘿蔔')).toBe('萝卜');
  });
  it('is identity for already-simplified spaceless names', () => {
    expect(normalizeName('牛奶')).toBe('牛奶');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/normalize-name.test.ts`
Expected: FAIL — "Failed to resolve import '../normalize-name'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/normalize-name.ts
// Lightweight, hand-maintained traditional→simplified map for grocery/daily terms.
// Goal: let 繁体 / 粤语版 users' names collide with the simplified canonical key.
// NOT a full OpenCC — extend this table as real mismatches show up.
const TRAD_TO_SIMP: Record<string, string> = {
  '醬': '酱', '漿': '浆', '鹽': '盐', '糖': '糖', '醋': '醋',
  '雞': '鸡', '鴨': '鸭', '鵝': '鹅', '魚': '鱼', '蝦': '虾', '蠔': '蚝',
  '鱈': '鳕', '鮭': '鲑', '鮮': '鲜', '鱸': '鲈', '鯽': '鲫', '鱿': '鱿',
  '豬': '猪', '醃': '腌', '滷': '卤', '燉': '炖',
  '蘿': '萝', '蔔': '卜', '蔥': '葱', '薑': '姜', '蒜': '蒜',
  '麵': '面', '飯': '饭', '餅': '饼', '餃': '饺', '麥': '麦', '饅': '馒',
  '蘋': '苹', '檸': '柠', '蕎': '荞', '蘆': '芦', '薺': '荠',
  '鵪': '鹌', '鶉': '鹑', '黃': '黄', '蓮': '莲', '筍': '笋',
  '凍': '冻', '糰': '团', '餛': '馄', '飩': '饨', '腸': '肠', '罐': '罐',
};

export function normalizeName(name: string): string {
  const stripped = name.trim().replace(/\s+/g, '');
  let out = '';
  for (const ch of stripped) out += TRAD_TO_SIMP[ch] ?? ch;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/normalize-name.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/normalize-name.ts src/utils/__tests__/normalize-name.test.ts
git commit -m "feat(icons): add normalizeName (simp/trad) util for icon matching"
```

---

## Task 2: Normalize preset matching in icon-registry (TDD)

**Files:**
- Modify: `src/utils/icon-registry.ts` (`getIconPath` ~268-274, `resolveIconUrl` ~280-294)
- Test: `src/utils/__tests__/icon-registry.test.ts`

**Invariant:** call sites of `resolveIconUrl`/`getIconPath` (ItemRow, ItemGrid, ShoppingMode, NewIconSheet, IconLibrary) are **unchanged**; only the two helpers' internals gain normalization.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/__tests__/icon-registry.test.ts
import { describe, it, expect } from 'vitest';
import { getIconPath, resolveIconUrl } from '../icon-registry';

describe('getIconPath with normalization', () => {
  it('matches a simplified preset name', () => {
    // 酱油 -> light-soy-sauce is a registered preset
    expect(getIconPath('酱油')).toBe('/icons/light-soy-sauce.webp');
  });
  it('matches the traditional form to the same preset', () => {
    expect(getIconPath('醬油')).toBe(getIconPath('酱油'));
  });
});

describe('resolveIconUrl with normalization', () => {
  it('finds a custom icon whose key was stored normalized', () => {
    const map = new Map<string, string>([['酱油', 'https://x/sauce.webp']]);
    // lookup with traditional form should still hit
    expect(resolveIconUrl('醬油', map)).toBe('https://x/sauce.webp');
  });
  it('returns null when nothing matches', () => {
    expect(resolveIconUrl('不存在的东西xyz', new Map())).toBeNull();
  });
});
```

> NOTE before writing: confirm the preset slug for 酱油. Run `grep "酱油" src/utils/icon-registry.ts` — if the slug differs from `light-soy-sauce`, use the actual slug in the test assertion.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/icon-registry.test.ts`
Expected: FAIL — `getIconPath('醬油')` returns null (no normalization yet).

- [ ] **Step 3: Edit `getIconPath` and `resolveIconUrl`**

Add the import at the top of `src/utils/icon-registry.ts`:

```typescript
import { normalizeName } from './normalize-name';
```

Replace `getIconPath`:

```typescript
export function getIconPath(name: string): string | null {
  const key = normalizeName(name);
  const exact = ICON_ITEMS.find(
    i => normalizeName(i.name) === key || i.aliases?.some(a => normalizeName(a) === key)
  );
  if (exact) return `/icons/${exact.icon}.webp`;
  const partial = ICON_ITEMS.find(
    i => key.includes(normalizeName(i.name)) || normalizeName(i.name).includes(key)
  );
  if (partial) return `/icons/${partial.icon}.webp`;
  return null;
}
```

Replace the custom-icon lookup inside `resolveIconUrl`:

```typescript
export function resolveIconUrl(
  name: string,
  customIconMap?: Map<string, string>
): string | null {
  if (customIconMap) {
    const custom = customIconMap.get(normalizeName(name));
    if (custom) return custom;
  }
  const preset = getIconPath(name);
  if (preset) return preset;
  return null;
}
```

> The custom map is now keyed by `normalizeName(name)` (see Task 3 `buildIconMap`). All callers still pass the raw `item.name`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/icon-registry.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/icon-registry.ts src/utils/__tests__/icon-registry.test.ts
git commit -m "feat(icons): normalize names in getIconPath/resolveIconUrl (simp/trad)"
```

---

## Task 3: `buildIconMap()` pure union-priority builder (TDD)

**Files:**
- Create: `src/lib/icon-map.ts`
- Test: `src/lib/__tests__/icon-map.test.ts`

This is the spec's key unit: library rows → `created_at`-earliest wins (first-author owns the name); assignment rows override; keys normalized.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/icon-map.test.ts
import { describe, it, expect } from 'vitest';
import { buildIconMap, type IconMapRow } from '../icon-map';

const url = (p: string) => `URL(${p})`;

describe('buildIconMap', () => {
  it('library same-name: earliest created_at wins (first-author owns name)', () => {
    const rows: IconMapRow[] = [
      { name: '酱油', image_path: 'new', source: 'ai_generated', kind: 'library', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
      { name: '酱油', image_path: 'old', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
    ];
    expect(buildIconMap(rows, url).get('酱油')).toBe('URL(old)');
  });

  it('assignment overrides library regardless of created_at', () => {
    const rows: IconMapRow[] = [
      { name: '酱油', image_path: 'lib', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { name: '酱油', image_path: 'assigned', source: 'upload', kind: 'assignment', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
    ];
    expect(buildIconMap(rows, url).get('酱油')).toBe('URL(assigned)');
  });

  it('normalizes keys so 椰漿 and 椰浆 collapse to one entry', () => {
    const rows: IconMapRow[] = [
      { name: '椰漿', image_path: 'trad', source: 'upload', kind: 'library', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ];
    const m = buildIconMap(rows, url);
    expect(m.get('椰浆')).toBe('URL(trad)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/icon-map.test.ts`
Expected: FAIL — cannot resolve `../icon-map`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/icon-map.ts
import { normalizeName } from '@/utils/normalize-name';

export interface IconMapRow {
  name: string;
  image_path: string;
  source: string;
  kind: 'library' | 'assignment';
  created_at: string;
  updated_at: string;
}

/**
 * Build the name→url map a list renders from.
 * Priority (low→high): library union (created_at EARLIEST wins) < this list's assignments.
 * Keys are normalized (simp/trad) so 椰漿/椰浆 collapse and resolveIconUrl(normalizeName(name)) hits.
 */
export function buildIconMap(
  rows: IconMapRow[],
  urlFor: (imagePath: string) => string
): Map<string, string> {
  const map = new Map<string, string>();

  // Library: sort created_at DESCENDING, set each -> the EARLIEST is written last and wins.
  const library = rows
    .filter(r => r.kind === 'library')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const r of library) map.set(normalizeName(r.name), urlFor(r.image_path));

  // Assignments override on top (unique per (list,name), so order among them is irrelevant).
  for (const r of rows.filter(r => r.kind === 'assignment')) {
    map.set(normalizeName(r.name), urlFor(r.image_path));
  }

  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/icon-map.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/icon-map.ts src/lib/__tests__/icon-map.test.ts
git commit -m "feat(icons): buildIconMap union builder (created_at-earliest + assignment override)"
```

---

## Task 4: Rewrite data layer `src/lib/custom-icons.ts` (account-scoped)

**Files:**
- Modify (full rewrite): `src/lib/custom-icons.ts`

Keep the file path and exported names (`CustomIcon`, `getPublicIconUrl`, `fetchListIconMap`→new, `uploadCustomIcon`, `deleteCustomIcon`, `generateIcon`, `getRemainingCredits`, `findExistingIcon`) to minimize import churn. Change `list_id`→`account_id` semantics. `generateIcon(name, listId, ref?)` keeps `listId` (Edge Function needs it for membership; resolves account server-side).

- [ ] **Step 1: Replace the file contents**

```typescript
// src/lib/custom-icons.ts
import { supabase } from './supabase';
import { buildIconMap, type IconMapRow } from './icon-map';

export interface CustomIcon {
  id: string;
  account_id: string;
  name: string;
  image_path: string;
  source: 'upload' | 'ai_generated' | 'ai_stylized';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'custom-icons';
const PER_ACCOUNT_DAILY = 5;

export function buildStoragePath(accountId: string, iconId: string): string {
  return `${accountId}/${iconId}.webp`;
}

export function getPublicIconUrl(imagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

/** Union map for a list: all members' accounts' libraries + this list's assignments. */
export async function fetchListIconMap(listId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('get_list_icon_map', { p_list_id: listId });
  if (error) throw error;
  return buildIconMap((data ?? []) as IconMapRow[], getPublicIconUrl);
}

/** The current account's own library (management page). */
export async function fetchMyLibrary(accountId: string): Promise<CustomIcon[]> {
  const { data, error } = await supabase
    .from('icon_library')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomIcon[];
}

export async function findExistingIcon(accountId: string, name: string): Promise<CustomIcon | null> {
  const { data, error } = await supabase
    .from('icon_library')
    .select('*')
    .eq('account_id', accountId)
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  return data as CustomIcon | null;
}

export async function uploadCustomIcon(
  accountId: string,
  name: string,
  blob: Blob,
  source: CustomIcon['source'],
  createdBy: string
): Promise<CustomIcon> {
  const iconId = crypto.randomUUID();
  const storagePath = buildStoragePath(accountId, iconId);

  const existing = await findExistingIcon(accountId, name);
  if (existing) {
    await supabase.storage.from(BUCKET).remove([existing.image_path]);
  }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/webp', upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: dbErr } = await supabase
    .from('icon_library')
    .upsert(
      { account_id: accountId, name, image_path: storagePath, source, created_by: createdBy },
      { onConflict: 'account_id,name' }
    )
    .select()
    .single();
  if (dbErr) throw dbErr;
  return data as CustomIcon;
}

export async function deleteCustomIcon(icon: CustomIcon): Promise<void> {
  await supabase.storage.from(BUCKET).remove([icon.image_path]);
  const { error } = await supabase.from('icon_library').delete().eq('id', icon.id);
  if (error) throw error;
}

export async function generateIcon(
  name: string,
  listId: string,
  referenceImageBase64?: string
): Promise<{ image_url: string; remaining_today: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const body: Record<string, string> = { name, list_id: listId };
  if (referenceImageBase64) body.reference_image = referenceImageBase64;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-icon`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (response.status === 429) {
    const err = await response.json();
    throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT', ...err });
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || 'Generation failed'), { code: 'GENERATION_FAILED' });
  }
  return response.json();
}

/** Remaining per-account daily generations (display only; server enforces the graduated gate). */
export async function getRemainingCredits(accountId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('ai_generation_log')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', today.toISOString());
  if (error) throw error;
  return Math.max(0, PER_ACCOUNT_DAILY - (count ?? 0));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in not-yet-updated consumers (`useCustomIcons.ts`, `IconLibrary.tsx`, `NewIconSheet.tsx`) about changed signatures — those are fixed in Tasks 5-7. No errors *inside* `custom-icons.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/custom-icons.ts
git commit -m "feat(icons): rewrite data layer to account-scoped icon_library + RPC union"
```

---

## Task 5: Hooks — `useCustomIcons` (RPC) + new `useMyLibrary`

**Files:**
- Modify: `src/hooks/useCustomIcons.ts`
- Create: `src/hooks/useMyLibrary.ts`

- [ ] **Step 1: Rewrite `useCustomIcons.ts`** (same return shape `{ iconMap, icons, loading, refresh }`; `icons` kept as `[]` for compat — no remaining consumer reads it after Task 6)

```typescript
// src/hooks/useCustomIcons.ts
import { useEffect, useState, useCallback } from 'react';
import { fetchListIconMap, type CustomIcon } from '@/lib/custom-icons';

export function useCustomIcons(listId: string | null) {
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());
  const [icons] = useState<CustomIcon[]>([]); // union has no single-list "icons"; kept for shape compat
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    try {
      setIconMap(await fetchListIconMap(listId));
    } catch (err) {
      console.error('Failed to fetch icon map:', err);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { iconMap, icons, loading, refresh };
}
```

- [ ] **Step 2: Create `useMyLibrary.ts`**

```typescript
// src/hooks/useMyLibrary.ts
import { useEffect, useState, useCallback } from 'react';
import { fetchMyLibrary, type CustomIcon } from '@/lib/custom-icons';

export function useMyLibrary(accountId: string | null) {
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    try {
      setIcons(await fetchMyLibrary(accountId));
    } catch (err) {
      console.error('Failed to fetch my icon library:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { icons, loading, refresh };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `IconLibrary.tsx` / `NewIconSheet.tsx` (Tasks 6-7).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCustomIcons.ts src/hooks/useMyLibrary.ts
git commit -m "feat(icons): useCustomIcons via RPC union; add useMyLibrary(accountId)"
```

---

## Task 6: Repoint `IconLibrary.tsx` to the account library

**Files:**
- Modify: `src/routes/IconLibrary.tsx` (lines 5, 15, 413-423)

- [ ] **Step 1: Swap the hook + import**

Replace line 5:

```typescript
import { useMyLibrary } from '@/hooks/useMyLibrary';
```

Replace line 15:

```typescript
  const { icons, refresh, loading: iconsLoading } = useMyLibrary(list?.account_id ?? null);
```

- [ ] **Step 2: Pass `accountId` to `NewIconSheet`**

Replace the `<NewIconSheet ... />` block (around lines 413-423) — add `accountId={list.account_id}`:

```tsx
      <NewIconSheet
        open={showNewSheet}
        uid={uid}
        listId={list.id}
        accountId={list.account_id}
        initialName={newSheetInitialName}
        onClose={() => {
          setShowNewSheet(false);
          setNewSheetInitialName(undefined);
        }}
        onIconCreated={refresh}
      />
```

> `onRegenerate` keeps `generateIcon(icon.name, list.id)` (membership via list_id is correct). `onDelete` keeps `deleteCustomIcon(icon)` (now deletes by `icon.id` from `icon_library`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining error only in `NewIconSheet.tsx` (missing `accountId` prop) — fixed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/routes/IconLibrary.tsx
git commit -m "feat(icons): IconLibrary uses account-scoped useMyLibrary"
```

---

## Task 7: `NewIconSheet` account-based upload + credits

**Files:**
- Modify: `src/components/NewIconSheet.tsx` (Props 8-15, signature 19, line 45, 91)

- [ ] **Step 1: Add `accountId` to Props + signature**

Props interface (8-15) — add `accountId`:

```typescript
interface Props {
  open: boolean;
  uid: string;
  listId: string;
  accountId: string;
  initialName?: string;
  onClose: () => void;
  onIconCreated: () => void | Promise<void>;
}
```

Signature (line 19):

```typescript
export function NewIconSheet({ open, uid, listId, accountId, initialName, onClose, onIconCreated }: Props) {
```

- [ ] **Step 2: Use account for credits + upload**

Line 45 — credits by account:

```typescript
      getRemainingCredits(accountId).then(setRemainingCredits).catch(() => {});
```

Line 91 — upload to account library:

```typescript
        await uploadCustomIcon(accountId, itemName, compressed, 'upload', uid);
```

> `generateIcon(itemName, listId, ...)` (line 112) stays — Edge Function resolves account from list. Add `accountId` to the effect deps array on line 58: `}, [open, uid, accountId, initialName]);`

- [ ] **Step 3: Typecheck (whole project should be clean now)**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/NewIconSheet.tsx
git commit -m "feat(icons): NewIconSheet uploads to account library, account credits"
```

---

## Task 8: Migration `010_account_icon_library.sql`

**Files:**
- Create: `supabase/migrations/010_account_icon_library.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 010_account_icon_library.sql
-- Move custom icons from per-list to per-account (icon_library), add the (empty-in-v1)
-- list_icon_assignments table, and a union RPC. See spec 2026-05-31-account-icon-library-design.md.
--
-- !!! RUN THE READ-ONLY AUDIT BELOW *BEFORE* APPLYING. Expect collision count ~= 0. !!!
--   SELECT count(*) AS total_icons FROM custom_icons;
--   SELECT count(*) AS would_collide FROM (
--     SELECT 1 FROM custom_icons c
--     JOIN lists l ON l.id = c.list_id
--     GROUP BY l.account_id, c.name HAVING count(*) > 1
--   ) x;
--   SELECT count(*) AS orphan_created_by FROM custom_icons c
--   WHERE NOT EXISTS (
--     SELECT 1 FROM accounts a WHERE a.member_uids @> ARRAY[c.created_by::uuid]
--   );

BEGIN;

-- 1. Rename (keeps data, storage paths, FKs, trigger).
ALTER TABLE custom_icons RENAME TO icon_library;

-- 2. Drop old list-based RLS (they reference list_id, which we drop below).
DROP POLICY IF EXISTS "members read custom_icons"   ON icon_library;
DROP POLICY IF EXISTS "members insert custom_icons" ON icon_library;
DROP POLICY IF EXISTS "members update custom_icons" ON icon_library;
DROP POLICY IF EXISTS "members delete custom_icons" ON icon_library;

-- 3. Add account_id (nullable for backfill).
ALTER TABLE icon_library ADD COLUMN account_id UUID REFERENCES accounts(id);

-- 4. Backfill: created_by's account (earliest), else the row's list's account.
UPDATE icon_library il SET account_id = COALESCE(
  (SELECT a.id FROM accounts a
     WHERE a.member_uids @> ARRAY[il.created_by::uuid]
     ORDER BY a.created_at ASC LIMIT 1),
  (SELECT l.account_id FROM lists l WHERE l.id = il.list_id)
);

-- 5. Dedup (account_id, name): keep created_at EARLIEST (ties -> smaller id), delete rest. Logged.
DO $$
DECLARE n INT;
BEGIN
  WITH del AS (
    DELETE FROM icon_library a USING icon_library b
    WHERE a.account_id = b.account_id AND a.name = b.name
      AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id))
    RETURNING a.id
  )
  SELECT count(*) INTO n FROM del;
  RAISE NOTICE '010 dedup: deleted % duplicate icon_library row(s)', n;
END $$;

-- 6. Lock account_id, swap unique key + indexes (dropping list_id removes its dependent index).
ALTER TABLE icon_library ALTER COLUMN account_id SET NOT NULL;
DROP INDEX IF EXISTS idx_custom_icons_list_name;
ALTER TABLE icon_library DROP COLUMN list_id;
CREATE UNIQUE INDEX idx_icon_library_account_name ON icon_library(account_id, name);
CREATE INDEX idx_icon_library_account ON icon_library(account_id);

-- 7. New account-based RLS.
CREATE POLICY "account members read icon_library" ON icon_library FOR SELECT
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "account members insert icon_library" ON icon_library FOR INSERT
  WITH CHECK (
    account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids))
    AND created_by = auth.uid()::text
  );
CREATE POLICY "account members update icon_library" ON icon_library FOR UPDATE
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "account members delete icon_library" ON icon_library FOR DELETE
  USING (account_id IN (SELECT id FROM accounts WHERE auth.uid() = ANY(member_uids)));

-- 8. GIN index on accounts.member_uids for the union overlap query (&&).
CREATE INDEX IF NOT EXISTS idx_accounts_member_uids_gin ON accounts USING GIN (member_uids);

-- 9. list_icon_assignments (empty in v1; written in v1.1).
CREATE TABLE list_icon_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon_id    UUID NOT NULL REFERENCES icon_library(id) ON DELETE CASCADE,
  set_by     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_lia_list_name ON list_icon_assignments(list_id, name);
CREATE INDEX idx_lia_list ON list_icon_assignments(list_id);
CREATE TRIGGER lia_touch_updated_at BEFORE UPDATE ON list_icon_assignments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
ALTER TABLE list_icon_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list members read lia" ON list_icon_assignments FOR SELECT
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "list members insert lia" ON list_icon_assignments FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids))
    AND set_by = auth.uid()::text
  );
CREATE POLICY "list members update lia" ON list_icon_assignments FOR UPDATE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "list members delete lia" ON list_icon_assignments FOR DELETE
  USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));

-- 10. Union RPC: members' accounts' libraries + this list's assignments.
CREATE OR REPLACE FUNCTION get_list_icon_map(p_list_id uuid)
RETURNS TABLE(name text, image_path text, source text, kind text, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_members uuid[];
BEGIN
  SELECT member_uids INTO v_members FROM lists WHERE id = p_list_id;
  IF v_members IS NULL THEN RAISE EXCEPTION 'list not found'; END IF;
  IF NOT (auth.uid() = ANY(v_members)) THEN RAISE EXCEPTION 'not a member'; END IF;

  RETURN QUERY
    SELECT il.name, il.image_path, il.source, 'library'::text, il.created_at, il.updated_at
    FROM icon_library il
    WHERE il.account_id IN (SELECT a.id FROM accounts a WHERE a.member_uids && v_members)
    UNION ALL
    SELECT la.name, il.image_path, il.source, 'assignment'::text, il.created_at, la.updated_at
    FROM list_icon_assignments la JOIN icon_library il ON il.id = la.icon_id
    WHERE la.list_id = p_list_id;
END;
$$;
GRANT EXECUTE ON FUNCTION get_list_icon_map(uuid) TO anon, authenticated;

-- 11. ai_generation_log: account_id + ip for per-account quota + monitoring.
ALTER TABLE ai_generation_log ADD COLUMN account_id UUID REFERENCES accounts(id);
ALTER TABLE ai_generation_log ADD COLUMN ip TEXT;
CREATE INDEX idx_ai_gen_log_account_date ON ai_generation_log(account_id, created_at);

-- 12. Storage: allow writes to {account_id}/ (bucket stays public-read; old list-folder policies remain for old files).
CREATE POLICY "account members upload icons" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM accounts WHERE auth.uid() = ANY(member_uids))
  );
CREATE POLICY "account members delete icons" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'custom-icons'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM accounts WHERE auth.uid() = ANY(member_uids))
  );

COMMIT;
```

- [ ] **Step 2: Lint the SQL by eye** (no DB apply here). Confirm order: rename → drop old policies → add/backfill account_id → dedup → drop list_id → new indexes/RLS → assignments → RPC → log cols → storage. Commit.

```bash
git add supabase/migrations/010_account_icon_library.sql
git commit -m "feat(icons): migration 010 - account icon_library, assignments, union RPC"
```

---

## Task 9: Rewrite Edge Function `generate-icon` (account quota + graduated gate)

**Files:**
- Modify: `supabase/functions/generate-icon/index.ts`

Changes vs current: resolve `account_id` from the list; count quota by `account_id`; graduated gate (`PRE_MATURITY=2`, mature = `>=3 items` OR account age `>=1h`, mature limit `5`); write `icon_library` by `(account_id,name)`; store under `{account_id}/`; log `account_id` + `ip`.

- [ ] **Step 1: Apply these edits** (keep the Gemini call, CORS, sanitize, prompt blocks unchanged)

Replace the limits constants (lines 9-10):

```typescript
const PRE_MATURITY_LIMIT = 2;     // brand-new account, first taste (keeps zero-reg first-use)
const MATURE_DAILY_LIMIT = 5;     // per account/day once mature
const DAILY_GLOBAL_LIMIT = 100;   // cost death-cap
const MATURE_MIN_ITEMS = 3;
const MATURE_MIN_AGE_MS = 60 * 60 * 1000; // 1h
```

Replace step 3 (membership check, lines 99-107) — also fetch `account_id`:

```typescript
    const { data: list } = await supabaseService
      .from('lists')
      .select('id, account_id')
      .eq('id', list_id)
      .contains('member_uids', [userUid])
      .maybeSingle();
    if (!list) {
      return jsonResponse({ error: 'Not a member of this list' }, 403);
    }
    const accountId = list.account_id as string;
    const clientIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || req.headers.get('x-real-ip') || null;
```

Replace step 4 (rate limits, lines 109-141) — account quota + graduated gate + global:

```typescript
    // 4. Rate limits — per ACCOUNT/day with a graduated maturity gate, plus the global cost cap.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { count: accountCount } = await supabaseService
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .gte('created_at', todayISO);

    // maturity: account age >= 1h OR >= 3 items across the account's lists
    const { data: acct } = await supabaseService
      .from('accounts').select('created_at').eq('id', accountId).maybeSingle();
    const ageMs = acct?.created_at ? Date.now() - new Date(acct.created_at).getTime() : 0;
    let mature = ageMs >= MATURE_MIN_AGE_MS;
    if (!mature) {
      const { count: itemCount } = await supabaseService
        .from('items')
        .select('id, lists!inner(account_id)', { count: 'exact', head: true })
        .eq('lists.account_id', accountId);
      mature = (itemCount ?? 0) >= MATURE_MIN_ITEMS;
    }
    const effectiveLimit = mature ? MATURE_DAILY_LIMIT : PRE_MATURITY_LIMIT;

    if ((accountCount ?? 0) >= effectiveLimit) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return jsonResponse({
        error: 'limit_exceeded',
        remaining_today: 0,
        reset_at: tomorrow.toISOString(),
        message: mature ? '今日额度已用完' : '新账号每日先开放 2 次，多加几样东西或稍后即可解锁更多',
      }, 429);
    }

    const { count: globalCount } = await supabaseService
      .from('ai_generation_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);
    if ((globalCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return jsonResponse({
        error: 'limit_exceeded', remaining_today: 0, message: '今日总额度已满，请明天再试',
      }, 429);
    }
```

Replace step 7's storage path (line 201):

```typescript
    const storagePath = `${accountId}/${iconId}.webp`;
```

Replace the existing-icon lookup (lines 204-209) — by account:

```typescript
    const { data: existingIcon } = await supabaseService
      .from('icon_library')
      .select('image_path')
      .eq('account_id', accountId)
      .eq('name', sanitizedName)
      .maybeSingle();
```

Replace step 8 upsert (lines 224-231) — icon_library:

```typescript
    const source = reference_image ? 'ai_stylized' : 'ai_generated';
    const { error: upsertErr } = await supabaseService
      .from('icon_library')
      .upsert(
        { account_id: accountId, name: sanitizedName, image_path: storagePath, source, created_by: userUid },
        { onConflict: 'account_id,name' }
      );
    if (upsertErr) throw upsertErr;
```

Replace step 9 log (lines 234-236) — add account_id + ip:

```typescript
    await supabaseService
      .from('ai_generation_log')
      .insert({ user_uid: userUid, item_name: sanitizedName, account_id: accountId, ip: clientIp });
```

Replace the `remaining` calc (line 241):

```typescript
    const remaining = effectiveLimit - (accountCount ?? 0) - 1;
```

- [ ] **Step 2: Eyeball the Deno file** (no local Deno typecheck assumed). Confirm `accountId`, `mature`, `effectiveLimit`, `clientIp` are all in scope where used. Commit.

```bash
git add supabase/functions/generate-icon/index.ts
git commit -m "feat(icons): generate-icon writes icon_library, per-account graduated quota"
```

---

## Task 10: Full local verification

- [ ] **Step 1: Unit tests**

Run: `npx vitest run`
Expected: all suites pass, including the 3 new ones (normalize-name, icon-registry, icon-map) and the pre-existing group-items / merge-frequent-items.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit anything outstanding** (if `npm run build` regenerated lockfiles or similar; otherwise skip).

---

## Task 11: HANDOFF — live DB migration + Edge deploy + smoke (user-run)

> These need live Supabase credentials and are irreversible; do NOT auto-run. Present to the user.

- [ ] **Step 1: Run the read-only audit** (top of `010_*.sql`) against the live DB. Confirm `would_collide ≈ 0` and `orphan_created_by` is as expected.
- [ ] **Step 2: Apply migration:** `supabase db push` (or paste `010_*.sql` in the SQL editor). Watch the `010 dedup: deleted N ...` NOTICE.
- [ ] **Step 3: Deploy Edge Function:** `supabase functions deploy generate-icon`.
- [ ] **Step 4: Smoke (per spec 上线步骤 §5):**
  - Existing custom icons still render (old `{list_id}/` storage paths resolve via public URL).
  - Cross-device: recover account on a second device → icons present.
  - Family same-name: two members, same item name → one consistent icon (first-author/created-at-earliest).
  - Generate a new icon → lands in `icon_library` under `{account_id}/`; brand-new account capped at 2 then unlocks.
  - Delete an icon in the library → item falls back to preset/watercolor.

---

## Self-Review

**Spec coverage:** migration/rename/backfill/dedup (Task 8) ✓; `(account_id,name)` unique + GIN (8) ✓; `get_list_icon_map` union returning `created_at` (8) ✓; `created_at`-earliest + assignment override map build (3) ✓; consumers untouched (5,6) ✓; `useMyLibrary` account page (5,6) ✓; simp/trad in v1 (1,2) ✓; account quota + graduated gate + ip log (9) ✓; storage account-folder policy (8) ✓; assignments table built but unwritten (8, scope note) ✓; audit + delete-logging (8,11) ✓. **Deferred (correctly, per spec):** assignment writes/reuse-selector (v1.1), realtime (v2).

**Placeholder scan:** none — every code/SQL step is complete. One verify-as-you-go note (Task 2 Step 1: confirm the 酱油 slug) is a guarded assertion, not a placeholder.

**Type consistency:** `CustomIcon` (account_id field) used identically across lib/hooks/components; `IconMapRow` shared by `icon-map.ts` + lib; `fetchListIconMap`/`fetchMyLibrary`/`uploadCustomIcon(accountId,...)`/`getRemainingCredits(accountId)` signatures match every call site updated in Tasks 5-7; RPC column set (`name,image_path,source,kind,created_at,updated_at`) matches `IconMapRow`.
