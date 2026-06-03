# Icon Reuse Selector + Library Search (v1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users borrow an existing union custom icon for a newly-typed item name (writes `list_icon_assignments`), plus a search box on the icon library page.

**Architecture:** One tiny read-only migration (`011` — `get_reusable_icons` RPC exposing union icon ids). New data-layer fns + 2 components (`ReuseIconRow`, `ReuseIconGrid`). AddSheet's "no icon" branch gains the reuse row above `IconPickerPanel`; picking writes an assignment via direct insert (RLS already allows it) then adds the item. IconLibrary gains a normalize-aware search box. Resolution order unchanged (v1's `buildIconMap` already layers assignment > union).

**Tech Stack:** React + Vite + TS, Supabase (RPC + RLS from v1), vitest. Spec: `docs/superpowers/specs/2026-06-03-icon-reuse-selector-design.md`.

**Verification reality:** Only one new pure unit (`matchesIconQuery`) is TDD'd. The rest is Supabase I/O + React UI — verified by `tsc --noEmit` + `vitest run` (existing 95 stay green) + `npm run build` + a browser smoke. **Migration 011 is applied to live DB by the user** (Task 8); the reuse-row browser smoke happens after that.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/011_reusable_icons_rpc.sql` | Create | `get_reusable_icons(list_id)` RPC (union icons + ids, member-checked) |
| `src/utils/icon-registry.ts` | Modify | add `matchesIconQuery()` (normalize-aware filter, shared by AddSheet + IconLibrary) |
| `src/utils/__tests__/icon-registry.test.ts` | Modify | tests for `matchesIconQuery` |
| `src/lib/custom-icons.ts` | Modify | add `ReusableIcon`, `fetchReusableIcons()`, `setListIconAssignment()` |
| `src/components/ReuseIconRow.tsx` | Create | inline thumbnail row + 「查看全部」 |
| `src/components/ReuseIconGrid.tsx` | Create | full-screen assign-mode searchable grid |
| `src/components/AddSheet.tsx` | Modify | no-icon branch: fetch reusable, render row, pick→assign+add, grid overlay; trigger via `resolveIconUrl` |
| `src/routes/IconLibrary.tsx` | Modify | search box filtering 我的 + 预设 |

---

## Task 1: Migration 011 — `get_reusable_icons` RPC

**Files:** Create `supabase/migrations/011_reusable_icons_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 011_reusable_icons_rpc.sql
-- Read-only RPC exposing union custom-icon ids for the reuse selector (v1.1).
-- No table/column/RLS changes.

CREATE OR REPLACE FUNCTION get_reusable_icons(p_list_id uuid)
RETURNS TABLE(id uuid, name text, image_path text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_members uuid[];
BEGIN
  SELECT member_uids INTO v_members FROM lists WHERE id = p_list_id;
  IF v_members IS NULL THEN RAISE EXCEPTION 'list not found'; END IF;
  IF NOT (auth.uid() = ANY(v_members)) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY
    SELECT il.id, il.name, il.image_path, il.created_at
    FROM icon_library il
    WHERE il.account_id IN (SELECT a.id FROM accounts a WHERE a.member_uids && v_members)
    ORDER BY il.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_reusable_icons(uuid) TO anon, authenticated;
```

- [ ] **Step 2: Commit** (apply is Task 8, by the user)

```bash
git add supabase/migrations/011_reusable_icons_rpc.sql
git commit -m "feat(icons): migration 011 - get_reusable_icons RPC (v1.1)"
```

---

## Task 2: `matchesIconQuery` search helper (TDD)

**Files:** Modify `src/utils/icon-registry.ts`; Test `src/utils/__tests__/icon-registry.test.ts`

- [ ] **Step 1: Add the failing test** (append to the existing describe blocks)

```typescript
import { matchesIconQuery } from '../icon-registry';

describe('matchesIconQuery', () => {
  it('empty query matches everything', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '')).toBe(true);
    expect(matchesIconQuery({ name: '辣椒酱' }, '   ')).toBe(true);
  });
  it('substring match on name', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '辣椒')).toBe(true);
    expect(matchesIconQuery({ name: '牛奶' }, '酱')).toBe(false);
  });
  it('normalizes simp/trad both sides', () => {
    expect(matchesIconQuery({ name: '辣椒酱' }, '辣椒醬')).toBe(true);
  });
  it('matches aliases', () => {
    expect(matchesIconQuery({ name: '西红柿', aliases: ['番茄'] }, '番茄')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`matchesIconQuery` not exported)

Run: `npx vitest run src/utils/__tests__/icon-registry.test.ts`
Expected: FAIL — `matchesIconQuery is not a function`.

- [ ] **Step 3: Implement** (add to `src/utils/icon-registry.ts`, after `getIconPath`)

```typescript
export function matchesIconQuery(
  item: { name: string; aliases?: string[] },
  query: string
): boolean {
  const q = normalizeName(query);
  if (!q) return true;
  if (normalizeName(item.name).includes(q)) return true;
  return item.aliases?.some(a => normalizeName(a).includes(q)) ?? false;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/utils/__tests__/icon-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/icon-registry.ts src/utils/__tests__/icon-registry.test.ts
git commit -m "feat(icons): add matchesIconQuery (normalize-aware icon search)"
```

---

## Task 3: Data layer — `fetchReusableIcons` + `setListIconAssignment`

**Files:** Modify `src/lib/custom-icons.ts`

- [ ] **Step 1: Add type + functions** (append near the other exports)

```typescript
export interface ReusableIcon {
  id: string;
  name: string;
  image_path: string;
}

/** Union of all list members' custom icons (with ids), for the reuse selector. */
export async function fetchReusableIcons(listId: string): Promise<ReusableIcon[]> {
  const { data, error } = await supabase.rpc('get_reusable_icons', { p_list_id: listId });
  if (error) throw error;
  return (data ?? []) as ReusableIcon[];
}

/** Pin (list, name) -> icon for this list (cross-name reuse). Upsert: re-pinning replaces. */
export async function setListIconAssignment(
  listId: string,
  name: string,
  iconId: string,
  setBy: string
): Promise<void> {
  const { error } = await supabase
    .from('list_icon_assignments')
    .upsert(
      { list_id: listId, name, icon_id: iconId, set_by: setBy },
      { onConflict: 'list_id,name' }
    );
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/custom-icons.ts
git commit -m "feat(icons): data layer for reusable icons + list assignment"
```

---

## Task 4: `ReuseIconRow` component

**Files:** Create `src/components/ReuseIconRow.tsx`

- [ ] **Step 1: Write the component** (styling follows AddSheet/IconPickerPanel theme)

```tsx
import { getPublicIconUrl, type ReusableIcon } from '@/lib/custom-icons';

interface Props {
  itemName: string;
  reusable: ReusableIcon[];
  onPick: (icon: ReusableIcon) => void;
  onViewAll: () => void;
}

const ROW_LIMIT = 8;

export function ReuseIconRow({ itemName, reusable, onPick, onViewAll }: Props) {
  if (reusable.length === 0) return null;
  const shown = reusable.slice(0, ROW_LIMIT);
  return (
    <div
      className="rounded-2xl p-3.5 mb-3"
      style={{ background: 'rgba(255,252,247,0.8)', border: '1px solid rgba(215,205,188,0.5)' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs" style={{ color: '#8a6d50' }}>
          给「{itemName}」选一张现成图
        </span>
        {reusable.length > ROW_LIMIT && (
          <button onClick={onViewAll} className="text-xs active:opacity-60" style={{ color: '#7ca982' }}>
            查看全部 ›
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {shown.map(icon => (
          <button
            key={icon.id}
            onClick={() => onPick(icon)}
            className="shrink-0 rounded-xl p-1.5 active:scale-95 transition-transform"
            style={{ background: 'white', border: '1px solid rgba(215,205,188,0.4)' }}
            aria-label={icon.name}
          >
            <img
              src={getPublicIconUrl(icon.image_path)}
              alt={icon.name}
              draggable={false}
              className="w-12 h-12 object-contain pointer-events-none"
              style={{ mixBlendMode: 'multiply' }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` → 0 errors.
- [ ] **Step 3: Commit.** `git add src/components/ReuseIconRow.tsx && git commit -m "feat(icons): ReuseIconRow component"`

---

## Task 5: `ReuseIconGrid` component (查看全部)

**Files:** Create `src/components/ReuseIconGrid.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react';
import { getPublicIconUrl, type ReusableIcon } from '@/lib/custom-icons';
import { matchesIconQuery } from '@/utils/icon-registry';

interface Props {
  itemName: string;
  reusable: ReusableIcon[];
  onPick: (icon: ReusableIcon) => void;
  onClose: () => void;
}

export function ReuseIconGrid({ itemName, reusable, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const filtered = reusable.filter(i => matchesIconQuery(i, q));
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(180deg, #faf6f0 0%, #f3ede4 100%)' }}>
      <header className="px-4 py-3 flex items-center gap-3 sticky top-0" style={{ background: 'rgba(250,246,240,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(215,205,188,0.3)' }}>
        <button onClick={onClose} className="text-xl active:opacity-60" style={{ color: '#a0937e' }} aria-label="返回">←</button>
        <div className="flex-1 text-sm font-semibold" style={{ color: '#5a4e3c' }}>给「{itemName}」选图</div>
      </header>
      <div className="px-4 py-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜索图标"
          className="w-full rounded-full px-4 py-2.5 text-sm outline-none"
          style={{ background: 'rgba(255,252,247,0.8)', border: '1px solid rgba(215,205,188,0.4)', color: '#5a4e3c' }}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-4 gap-2.5">
          {filtered.map(icon => (
            <button key={icon.id} onClick={() => onPick(icon)} className="flex flex-col items-center rounded-xl p-2 active:scale-95 transition-transform" style={{ background: 'white', border: '1px solid rgba(215,205,188,0.4)' }}>
              <img src={getPublicIconUrl(icon.image_path)} alt={icon.name} draggable={false} className="w-12 h-12 object-contain pointer-events-none" style={{ mixBlendMode: 'multiply' }} />
              <span className="text-[10px] mt-1 truncate w-full text-center" style={{ color: '#5a4e3c' }}>{icon.name}</span>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: '#a0937e' }}>没有匹配的图标</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck → 0 errors. Step 3: Commit.** `git add src/components/ReuseIconGrid.tsx && git commit -m "feat(icons): ReuseIconGrid (full-screen reuse picker)"`

---

## Task 6: AddSheet integration

**Files:** Modify `src/components/AddSheet.tsx`

- [ ] **Step 1: Imports + state**

Add to imports (line ~15-17 area):
```tsx
import { uploadCustomIcon, generateIcon, findExistingIcon, getRemainingCredits, fetchReusableIcons, setListIconAssignment, type ReusableIcon } from '@/lib/custom-icons';
import { resolveIconUrl } from '@/utils/icon-registry';
import { ReuseIconRow } from '@/components/ReuseIconRow';
import { ReuseIconGrid } from '@/components/ReuseIconGrid';
```

Add state (after `pendingItemName`, ~line 104):
```tsx
  const [reusableIcons, setReusableIcons] = useState<ReusableIcon[]>([]);
  const [showReuseGrid, setShowReuseGrid] = useState(false);
```

Reset on close (in the `if (!open)` effect, ~line 158):
```tsx
      setReusableIcons([]);
      setShowReuseGrid(false);
```

- [ ] **Step 2: Trigger via `resolveIconUrl` + fetch reusable** — replace `submitTyped` (lines 243-266)

```tsx
  const submitTyped = () => {
    const name = value.trim();
    if (!name) return;
    const hasIcon = resolveIconUrl(name, customIconMap) !== null;
    if (!hasIcon) {
      setPendingItemName(name);
      setShowIconPicker(true);
      fetchReusableIcons(listId).then(setReusableIcons).catch(() => setReusableIcons([]));
      return;
    }
    toggleItem(name, { name, note: '', quantity: '', supermarket: selectedMarket });
    setValue('');
  };
```

- [ ] **Step 3: Pick handler** (add near `handleSkipIcon`)

```tsx
  const handleReusePick = async (icon: ReusableIcon) => {
    if (!pendingItemName) return;
    try {
      await setListIconAssignment(listId, pendingItemName, icon.id, uid);
      await onIconsChanged();
    } catch { alert('设置失败，请重试'); return; }
    toggleItem(pendingItemName, { name: pendingItemName, note: '', quantity: '', supermarket: selectedMarket });
    setShowReuseGrid(false);
    setShowIconPicker(false);
    setPendingItemName('');
    setReusableIcons([]);
    setValue('');
  };
```

- [ ] **Step 4: Render the row** — in the `{showIconPicker && pendingItemName && (...)}` block (line ~701), wrap so the row sits above `IconPickerPanel`:

```tsx
              {showIconPicker && pendingItemName && (
                <>
                  <ReuseIconRow
                    itemName={pendingItemName}
                    reusable={reusableIcons}
                    onPick={handleReusePick}
                    onViewAll={() => setShowReuseGrid(true)}
                  />
                  <IconPickerPanel
                    itemName={pendingItemName}
                    category="其他"
                    remainingCredits={remainingCredits}
                    onUpload={handleUploadPhoto}
                    onAiGenerate={() => handleAiGenerate()}
                    onSkip={handleSkipIcon}
                  />
                </>
              )}
```

- [ ] **Step 5: Render the grid overlay** — before the closing `</div>` of the root (after the IconPreviewOverlay, ~line 763):

```tsx
      {showReuseGrid && (
        <ReuseIconGrid
          itemName={pendingItemName}
          reusable={reusableIcons}
          onPick={handleReusePick}
          onClose={() => setShowReuseGrid(false)}
        />
      )}
```

- [ ] **Step 6: Typecheck → 0 errors.** (`UNIQUE_ICON_ITEMS` import may become unused in `submitTyped` but is still used by `allIcons`/`filtered` — keep it.)
- [ ] **Step 7: Commit.** `git add src/components/AddSheet.tsx && git commit -m "feat(icons): reuse selector in AddSheet (borrow union icon -> assignment)"`

---

## Task 7: IconLibrary search box

**Files:** Modify `src/routes/IconLibrary.tsx`

- [ ] **Step 1: Import + state**

Add import: `import { matchesIconQuery } from '@/utils/icon-registry';` (extend the existing icon-registry import).
Add state (near other useState, ~line 23): `const [query, setQuery] = useState('');`

- [ ] **Step 2: Filter both sections** — after `sortedIcons` / `visiblePresets` are computed (lines 36-44), apply the query:

```tsx
  const q = query.trim();
  const shownCustom = q ? sortedIcons.filter(i => matchesIconQuery(i, q)) : sortedIcons;
  const shownPresets = q ? visiblePresets.filter(i => matchesIconQuery(i, q)) : visiblePresets;
```
Then use `shownCustom` / `shownPresets` in the two `.map(...)` renders and their count labels (`自定义 · {shownCustom.length}`, `预设 · {shownPresets.length}`), and gate the custom section on `shownCustom.length > 0`.

- [ ] **Step 3: Add the search input** — directly under the `<header>` (after line 121):

```tsx
      <div className="px-4 pt-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索图标"
          className="w-full rounded-full px-4 py-2.5 text-sm outline-none"
          style={{ background: 'rgba(255,252,247,0.8)', border: '1px solid rgba(215,205,188,0.4)', color: '#5a4e3c' }}
        />
      </div>
```

- [ ] **Step 4: Typecheck → 0 errors. Step 5: Commit.** `git add src/routes/IconLibrary.tsx && git commit -m "feat(icons): search box on icon library page"`

---

## Task 8: Verify + migration handoff

- [ ] **Step 1: Full local verify**

Run: `npx vitest run` → all pass (96: +matchesIconQuery). `npx tsc --noEmit` → 0 errors. `npm run build` → succeeds.

- [ ] **Step 2: HANDOFF — apply migration 011 (user)**

`npx supabase db push` (or paste `011_reusable_icons_rpc.sql` in SQL Editor; the user is already `npx supabase` logged in). Read-only function, safe.

- [ ] **Step 3: Browser smoke (after 011 applied)**

- Need ≥1 union custom icon. Type a NEW name with no icon (e.g. a brand variant) → reuse row shows union icons → tap one → item adds with the borrowed icon (assignment written; `get_list_icon_map` now returns it as `kind=assignment`).
- 「查看全部」→ grid opens, search filters, pick works.
- Empty union (fresh account, no custom icons) → no reuse row, just 上传/AI/跳过.
- IconLibrary: search filters 我的 + 预设.

---

## Self-Review

**Spec coverage:** migration 011 (T1) ✓; union source via RPC (T1,T3) ✓; reuse row + 查看全部 (T4,T5,T6) ✓; pick→assignment→add→refresh (T6) ✓; empty-state fallback (T4 returns null + T6 keeps IconPickerPanel) ✓; trigger via resolveIconUrl + simp/trad fix (T6 Step 2) ✓; library search (T7) ✓; library "replace" unchanged (no task — correct, stays existing NewIconSheet flow) ✓; assignment cascade on icon delete (v1 010, no task) ✓. **Deferred per spec:** per-list override UI, preset cross-name borrow, realtime.

**Placeholder scan:** none — all steps have concrete code/commands.

**Type consistency:** `ReusableIcon {id,name,image_path}` defined in T3, used in T4/T5/T6. `fetchReusableIcons(listId)`, `setListIconAssignment(listId,name,iconId,setBy)`, `matchesIconQuery(item,query)` signatures consistent across T2/T3/T6/T7. `get_reusable_icons` columns (id,name,image_path,created_at) ⊇ `ReusableIcon`.
