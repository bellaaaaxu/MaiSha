# AddSheet UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four UX pain points in the AddSheet and main list: misleading "cancel" button, duplicate frequent items, slow item appearance, and clunky store selection + ItemMenu.

**Architecture:** Four sequential changes to AddSheet.tsx and surrounding files. Each task produces a self-contained commit. Tasks touch the same files so they must run in order: #4 (text fix) → #3 (frequent dedup) → #1 (optimistic update) → #2 (store-first flow + remove ItemMenu).

**Tech Stack:** React 18, TypeScript, Supabase real-time, i18next, @dnd-kit, Vite

---

## File Map

| File | Responsibility | Tasks |
|------|---------------|-------|
| `src/components/AddSheet.tsx` | Bottom sheet for adding items | 1, 2, 4 |
| `src/locales/zh-CN.json` | Chinese translations | 1 |
| `src/locales/en.json` | English translations | 1 |
| `src/utils/merge-frequent-items.ts` | **NEW** — merge + deduplicate two frequency sources | 2 |
| `src/utils/__tests__/merge-frequent-items.test.ts` | **NEW** — tests for merge utility | 2 |
| `src/hooks/useItems.ts` | Items state + real-time subscription | 3 |
| `src/lib/realtime.ts` | Supabase real-time channel | 3 |
| `src/routes/List.tsx` | Main list page orchestrator | 2, 3, 4 |
| `src/components/StoreCard.tsx` | Store card with item grid | 4 |
| `src/components/ItemGrid.tsx` | 4-column item grid display | 4 |
| `src/routes/EditItem.tsx` | Item edit page (already has delete) | 4 (no changes needed) |

**Files removed:** `src/components/ItemMenu.tsx` (Task 4)

**Files left unchanged but decoupled:** `src/components/SetIconSheet.tsx` (no longer rendered from List.tsx; icon setting accessible via Settings > Icon Library at `/icons`)

---

## Design Decision: Grid Layout vs Swipe-to-Delete

The main list displays items in a **4-column icon grid** (ItemGrid), not a row-based list. Swipe-to-delete is impractical on small grid items. Instead:

- **Tap item** → navigate to EditItem page (which already has edit fields + delete button)
- This replaces both "edit" and "delete" from the removed ItemMenu
- Simpler, consistent with the compact grid layout

---

## Task 1: Change "Cancel" to "Done" (#4)

**Files:**
- Modify: `src/locales/zh-CN.json`
- Modify: `src/locales/en.json`
- Modify: `src/components/AddSheet.tsx:429-435`

- [ ] **Step 1: Add i18n key for "done"**

In `src/locales/zh-CN.json`, add `common.done`:

```json
"common": {
    "cancel": "取消",
    "confirm": "确认",
    "delete": "删除",
    "done": "完成",
    "edit": "编辑",
    "save": "保存",
    "loading": "加载中…"
}
```

In `src/locales/en.json`, add `common.done`:

```json
"common": {
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "done": "Done",
    "edit": "Edit",
    "save": "Save",
    "loading": "Loading…"
}
```

- [ ] **Step 2: Update AddSheet close button**

In `src/components/AddSheet.tsx`, change the close button (around line 429-435):

```tsx
<button
  onClick={onClose}
  className="text-sm px-3 py-1 rounded-lg active:opacity-60"
  style={{ color: '#7ca982', fontWeight: 600 }}
>
  {t('common.done')}
</button>
```

Changes: text from `t('common.cancel')` → `t('common.done')`, color from `#a0937e` (gray) → `#7ca982` (green), added `fontWeight: 600`, padding `px-2` → `px-3`.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Open AddSheet, verify:
- Button says "完成" (zh-CN) or "Done" (en)
- Button is green, feels like a positive completion action
- Clicking it still closes the sheet normally

- [ ] **Step 4: Commit**

```bash
git add src/locales/zh-CN.json src/locales/en.json src/components/AddSheet.tsx
git commit -m "fix: change AddSheet close button from 'Cancel' to 'Done'

Users felt that 'Cancel' implied their additions would be undone.
Items are already saved when tapped, so 'Done' correctly signals
that the sheet is simply closing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Merge and Deduplicate Frequent Sections (#3)

**Files:**
- Create: `src/utils/merge-frequent-items.ts`
- Create: `src/utils/__tests__/merge-frequent-items.test.ts`
- Modify: `src/components/AddSheet.tsx`
- Modify: `src/routes/List.tsx:298-309`

### Step Group A: Build the merge utility

- [ ] **Step 1: Write the test for merge-frequent-items**

Create `src/utils/__tests__/merge-frequent-items.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mergeFrequentItems, type MergedFrequentItem } from '../merge-frequent-items';
import type { FrequentlyBoughtItem } from '../frequently-bought';
import type { FrequentItem } from '../frequent-items';

describe('mergeFrequentItems', () => {
  it('merges items from both sources, deduplicated by name', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
      { name: '牛奶', category: '其他', category_emoji: '📦', count: 3 },
    ];
    const local: FrequentItem[] = [
      { name: '鸡蛋', note: '', supermarket: 'costco', category_emoji: '📦', count: 10, lastUsedAt: 1000 },
      { name: '面包', note: '', supermarket: 'none', category_emoji: '📦', count: 4, lastUsedAt: 900 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    const names = result.map(r => r.name);
    expect(names).toContain('鸡蛋');
    expect(names).toContain('牛奶');
    expect(names).toContain('面包');
    // '鸡蛋' appears only once
    expect(names.filter(n => n === '鸡蛋')).toHaveLength(1);
  });

  it('respects the limit parameter', () => {
    const history: FrequentlyBoughtItem[] = Array.from({ length: 10 }, (_, i) => ({
      name: `item-${i}`, category: '其他', category_emoji: '📦', count: 10 - i,
    }));
    const result = mergeFrequentItems(history, [], 5);
    expect(result).toHaveLength(5);
  });

  it('prioritizes history items over local-only items', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
    ];
    const local: FrequentItem[] = [
      { name: '面包', note: '', supermarket: 'none', category_emoji: '📦', count: 100, lastUsedAt: 9999 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    expect(result[0].name).toBe('鸡蛋');
  });

  it('returns empty array when both sources are empty', () => {
    expect(mergeFrequentItems([], [], 8)).toEqual([]);
  });

  it('preserves note and supermarket from local data when available', () => {
    const history: FrequentlyBoughtItem[] = [
      { name: '鸡蛋', category: '其他', category_emoji: '📦', count: 5 },
    ];
    const local: FrequentItem[] = [
      { name: '鸡蛋', note: '土鸡蛋', supermarket: 'costco', category_emoji: '📦', count: 3, lastUsedAt: 1000 },
    ];
    const result = mergeFrequentItems(history, local, 8);
    expect(result[0].note).toBe('土鸡蛋');
    expect(result[0].supermarket).toBe('costco');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/merge-frequent-items.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement merge-frequent-items**

Create `src/utils/merge-frequent-items.ts`:

```typescript
import type { FrequentlyBoughtItem } from './frequently-bought';
import type { FrequentItem } from './frequent-items';

export interface MergedFrequentItem {
  name: string;
  note: string;
  supermarket: string;
}

export function mergeFrequentItems(
  historyItems: FrequentlyBoughtItem[],
  localItems: FrequentItem[],
  limit: number,
): MergedFrequentItem[] {
  const seen = new Set<string>();
  const result: MergedFrequentItem[] = [];

  const localByName = new Map(localItems.map(l => [l.name, l]));

  // History items first (higher signal — actual purchases)
  for (const h of historyItems) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    const local = localByName.get(h.name);
    result.push({
      name: h.name,
      note: local?.note ?? '',
      supermarket: local?.supermarket ?? 'none',
    });
  }

  // Then local-only items
  for (const l of localItems) {
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    result.push({
      name: l.name,
      note: l.note,
      supermarket: l.supermarket,
    });
  }

  return result.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/merge-frequent-items.test.ts`
Expected: All 5 tests PASS

### Step Group B: Update AddSheet to use merged frequent section

- [ ] **Step 5: Add `existingItemNames` prop to AddSheet**

In `src/components/AddSheet.tsx`, update the Props interface:

```typescript
interface Props {
  open: boolean;
  uid: string;
  listId: string;
  supermarkets: Store[];
  customIconMap: Map<string, string>;
  existingItemNames: Set<string>;
  onClose: () => void;
  onAdd: (input: NewItemInput) => Promise<string>;
  onRemove: (itemId: string) => Promise<void>;
  onIconsChanged: () => void | Promise<void>;
  onOpenImport?: () => void;
}
```

Update the function signature to destructure the new prop:

```typescript
export function AddSheet({ open, uid, listId, supermarkets, customIconMap, existingItemNames, onClose, onAdd, onRemove, onIconsChanged, onOpenImport }: Props) {
```

- [ ] **Step 6: Replace two frequent sections with one merged section**

In `src/components/AddSheet.tsx`:

1. Add import at top:
```typescript
import { mergeFrequentItems } from '@/utils/merge-frequent-items';
```

2. Replace the separate `frequentlyBought` and `frequent` useMemos with a single merged one. Remove the `frequent` state and `getTopFrequentItems` call from the useEffect. Replace with:

```typescript
const mergedFrequent = useMemo(
  () => mergeFrequentItems(frequentlyBought, getTopFrequentItems(uid, 12), 8),
  [frequentlyBought, uid]
);
```

Note: Remove the `frequent` state variable (`useState<FrequentItem[]>([])`) and the `setFrequent(getTopFrequentItems(uid, 12))` line from the `useEffect`.

3. Replace the two separate rendering blocks (`{!value && frequentlyBought.length > 0 && (...)}` and `{!value && frequent.length > 0 && (...)}`) with a single block:

```tsx
{!value && mergedFrequent.length > 0 && (
  <div className="mb-3">
    <div className="flex items-center gap-2 mb-2.5 px-1">
      <div className="w-1.5 h-4 rounded-full" style={{ background: '#c97b63' }} />
      <span className="text-xs font-medium tracking-wider" style={{ color: '#7a6e5d' }}>
        {t('addSheet.frequent')}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #e0d6c6 0%, transparent 100%)' }} />
    </div>
    <div className="grid grid-cols-4 gap-2">
      {mergedFrequent.map(f => {
        const inList = existingItemNames.has(f.name);
        const added = addedItems.has(f.name);
        const disabled = inList && !added;
        const anim = animating.get(f.name);
        const customUrl = customIconMap.get(f.name);
        const presetItem = !customUrl ? UNIQUE_ICON_ITEMS.find(i => i.name === f.name || i.aliases?.includes(f.name)) : null;
        const freqErrorKey = customUrl ? `custom:${f.name}` : presetItem?.icon ?? '';
        const iconSrc = customUrl ?? (presetItem ? `/icons/${presetItem.icon}.webp` : null);
        const showIcon = !!iconSrc && !iconErrors.has(freqErrorKey);
        const iconUrl = showIcon ? iconSrc : null;
        return (
          <IconButton
            key={`freq-${f.name}`}
            iconUrl={iconUrl}
            itemName={f.name}
            category="其他"
            added={added}
            anim={disabled ? undefined : anim}
            size="frequent"
            onTap={() => {
              if (disabled) return;
              toggleItem(f.name, {
                name: f.name,
                note: f.note,
                quantity: '',
                supermarket: selectedMarket,
              });
            }}
            onLongPress={setPreviewIcon}
          >
            <div className="w-12 h-12 mb-1 flex items-center justify-center relative">
              {showIcon ? (
                <img
                  src={iconUrl!}
                  alt={f.name}
                  draggable={false}
                  className="w-full h-full object-contain rounded-lg pointer-events-none"
                  style={{
                    mixBlendMode: 'multiply',
                    opacity: disabled ? 0.3 : added ? 0.45 : 1,
                    transition: 'opacity 0.3s',
                    filter: disabled ? 'grayscale(1)' : 'none',
                  }}
                  onError={() => setIconErrors(prev => new Set(prev).add(freqErrorKey))}
                />
              ) : (
                <div style={{
                  opacity: disabled ? 0.3 : added ? 0.45 : 1,
                  transition: 'opacity 0.3s',
                  filter: disabled ? 'grayscale(1)' : 'none',
                }}>
                  <WatercolorFallback name={f.name} category="其他" size={40} />
                </div>
              )}
              {added && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'checkPop 0.3s ease' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#7ca982' }}>
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
              {disabled && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                  <span className="text-[8px] whitespace-nowrap" style={{ color: '#b8a992' }}>已在清单</span>
                </div>
              )}
            </div>
          </IconButton>
        );
      })}
    </div>
  </div>
)}
```

Also remove the "全部加上" button from the old frequentlyBought section — it's no longer needed since the merged section is capped at 8 items and adding all at once was confusing.

- [ ] **Step 7: Pass `existingItemNames` from List.tsx**

In `src/routes/List.tsx`, compute and pass the prop:

```typescript
const existingItemNames = useMemo(
  () => new Set(items.map(i => i.name)),
  [items]
);
```

And in the AddSheet JSX:

```tsx
<AddSheet
  open={showAdd}
  uid={uid}
  listId={list.id}
  supermarkets={list.supermarkets}
  customIconMap={customIconMap}
  existingItemNames={existingItemNames}
  onClose={() => setShowAdd(false)}
  onAdd={onAdd}
  onRemove={onRemoveAdded}
  onIconsChanged={refreshIcons}
  onOpenImport={() => { setShowAdd(false); setShowImport(true); }}
/>
```

- [ ] **Step 8: Verify in browser**

Run: `npm run dev`

Check:
- Only one "常买" section appears (no duplicates)
- Max 8 items shown
- Items already in the list show grayed out with "已在清单" label
- Items already in the list are not tappable
- Newly added items still show green ✓ as before
- Search/filter still works for the main icon grid below

- [ ] **Step 9: Run tests**

Run: `npx vitest run`
Expected: All tests pass (both existing group-items tests and new merge-frequent-items tests)

- [ ] **Step 10: Commit**

```bash
git add src/utils/merge-frequent-items.ts src/utils/__tests__/merge-frequent-items.test.ts src/components/AddSheet.tsx src/routes/List.tsx
git commit -m "fix: merge duplicate frequent sections and mark existing items

Frequent items from purchase history and local usage were showing
in two separate sections, causing visual duplication. Merged into
one deduplicated section (max 8 items). Items already in the
shopping list now show as grayed-out 'already in list'.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Optimistic Updates (#1)

**Files:**
- Modify: `src/hooks/useItems.ts`
- Modify: `src/lib/realtime.ts`
- Modify: `src/routes/List.tsx`

- [ ] **Step 1: Add optimistic methods to useItems**

Replace `src/hooks/useItems.ts` entirely:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchItems } from '@/lib/db';
import { subscribeItems } from '@/lib/realtime';
import type { Item } from '@/types/item';

export function useItems(listId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const initial = await fetchItems(listId);
        if (cancelled) return;
        setItems(initial);
        setLoading(false);
        unsub = subscribeItems(listId, (realtimeItems) => {
          setItems(prev => {
            // Merge: real-time items replace optimistic ones by id
            const realIds = new Set(realtimeItems.map(i => i.id));
            // Remove optimistic ids that now have real counterparts
            for (const id of realIds) {
              optimisticIdsRef.current.delete(id);
            }
            // Keep optimistic items that haven't arrived via real-time yet
            const stillOptimistic = prev.filter(
              i => optimisticIdsRef.current.has(i.id) && !realIds.has(i.id)
            );
            return [...realtimeItems, ...stillOptimistic];
          });
        }, initial);
      } catch (err) {
        if (!cancelled) { setError((err as Error).message); setLoading(false); }
      }
    })();

    return () => { cancelled = true; if (unsub) unsub(); };
  }, [listId]);

  const optimisticAdd = useCallback((item: Item) => {
    optimisticIdsRef.current.add(item.id);
    setItems(prev => [...prev, item]);
  }, []);

  const optimisticRemove = useCallback((itemId: string) => {
    optimisticIdsRef.current.delete(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  return { items, loading, error, optimisticAdd, optimisticRemove };
}
```

- [ ] **Step 2: Use optimistic methods in List.tsx**

In `src/routes/List.tsx`, destructure the new methods:

```typescript
const { items, loading: itemsLoading, optimisticAdd, optimisticRemove } = useItems(list?.id ?? null);
```

Update `onAdd` to insert optimistically:

```typescript
const onAdd = async (input: NewItemInput): Promise<string> => {
  const item = await addItem(list.id, uid, input);
  optimisticAdd(item);
  recordItemUsage(uid, {
    name: input.name,
    note: input.note ?? '',
    supermarket: input.supermarket ?? 'none',
    category_emoji: '📦',
  });
  return item.id;
};
```

Update `onRemoveAdded` to remove optimistically:

```typescript
const onRemoveAdded = async (itemId: string) => {
  optimisticRemove(itemId);
  await deleteItem(itemId);
};
```

Update `onMenuDelete` to remove optimistically:

```typescript
const onMenuDelete = async (item: Item) => {
  try {
    optimisticRemove(item.id);
    await deleteItem(item.id);
    undoToast.show(`已删除「${item.name}」`, async () => {
      try {
        const restored = await addItem(list.id, uid, {
          name: item.name,
          note: item.note,
          quantity: item.quantity,
          supermarket: item.supermarket,
        });
        optimisticAdd(restored);
      } catch { /* silent */ }
    });
  } catch {
    alert('删除失败');
  }
};
```

Note: `onMenuDelete` and `onMenuDuplicate` will be removed in Task 4, but we update them here so this commit works correctly on its own.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Check:
- Add an item via AddSheet — it should appear in the list **instantly** (no waiting for Supabase round-trip)
- Toggle the item off in AddSheet (remove) — it should disappear from the list immediately
- Refresh the page — the item should still be there (persisted via Supabase)
- Open in two browser tabs — adding in one tab should still propagate to the other via real-time (no duplicate items)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useItems.ts src/routes/List.tsx
git commit -m "feat: add optimistic updates for instant item add/remove

Items now appear in the list immediately when added, without
waiting for the Supabase real-time round-trip. Optimistic items
are reconciled when the real-time event arrives.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Store-First Flow + Remove ItemMenu (#2)

This task has three sub-tasks:
- 4A: Remove ItemMenu, tap item → navigate to EditItem
- 4B: Add "+" button to each StoreCard
- 4C: Add store selection step to AddSheet

### Task 4A: Remove ItemMenu

**Files:**
- Modify: `src/routes/List.tsx`
- Modify: `src/components/ItemGrid.tsx`
- Remove reference to: `src/components/ItemMenu.tsx`

- [ ] **Step 1: Update ItemGrid to accept `onItemTap` with navigation intent**

No changes needed to ItemGrid itself — it already accepts `onItemTap` callback. The change is in how List.tsx calls it.

- [ ] **Step 2: Remove ItemMenu from List.tsx**

In `src/routes/List.tsx`:

1. Remove imports:
```typescript
// DELETE these lines:
import { ItemMenu } from '@/components/ItemMenu';
import { SetIconSheet } from '@/components/SetIconSheet';
```

2. Remove state variables:
```typescript
// DELETE these lines:
const [menuItem, setMenuItem] = useState<Item | null>(null);
const [setIconItem, setSetIconItem] = useState<Item | null>(null);
```

3. Remove handler functions:
```typescript
// DELETE these entire functions:
const onMenuDuplicate = ...
const onMenuEdit = ...
const onMenuSetIcon = ...
```

Note: Keep `onMenuDelete` for now — rename it to `onItemDelete` and keep it for potential future use. Actually, delete it too since we're removing the menu. Delete from EditItem page handles deletion.

4. Update `onItemTap` in StoreCard to navigate:
```tsx
<StoreCard
  key={group.store.id}
  group={group}
  customIconMap={customIconMap}
  onItemTap={(item) => nav(`/edit-item/${item.id}`)}
  colorIndex={i}
/>
```

5. Remove the ItemMenu and SetIconSheet JSX blocks:
```tsx
// DELETE these blocks:
<ItemMenu ... />
<SetIconSheet ... />
```

- [ ] **Step 3: Delete ItemMenu.tsx**

Delete the file `src/components/ItemMenu.tsx`.

- [ ] **Step 4: Verify in browser**

Check:
- Tapping an item in the grid navigates to the EditItem page
- EditItem page loads correctly with item data
- Edit fields (name, note, quantity, store) work
- Delete button on EditItem works
- Back button returns to list
- No console errors about missing ItemMenu

- [ ] **Step 5: Commit**

```bash
git add src/routes/List.tsx src/components/ItemGrid.tsx
git rm src/components/ItemMenu.tsx
git commit -m "refactor: remove ItemMenu, tap item navigates to edit page

ItemMenu was a heavy modal with rarely-used options. Now tapping
an item in the grid goes directly to the edit page, which already
has edit fields and a delete button. SetIconSheet is also removed
from the main list — icon customization is accessible via Settings.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 4B: Add "+" Button to StoreCard

**Files:**
- Modify: `src/components/StoreCard.tsx`
- Modify: `src/routes/List.tsx`

- [ ] **Step 1: Add `onAddItem` prop to StoreCard**

Update `src/components/StoreCard.tsx`:

```typescript
interface Props {
  group: StoreGroup;
  customIconMap?: Map<string, string>;
  onItemTap?: (item: Item) => void;
  onAddItem?: (storeId: string) => void;
  colorIndex?: number;
}
```

Update the function signature:
```typescript
export function StoreCard({ group, customIconMap, onItemTap, onAddItem, colorIndex = 0 }: Props) {
```

Add the "+" button in the store header, next to the item count:

```tsx
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
}}>
  <span style={{
    fontFamily: 'var(--font-title)',
    fontSize: 22,
    color: 'var(--ink)',
  }}>
    {group.store.name}
  </span>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
      {t('list.items', { count: group.totalCount })}
    </span>
    {onAddItem && (
      <button
        onClick={() => onAddItem(group.store.id)}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '1.5px dashed var(--ink-faint)',
          background: 'none',
          color: 'var(--ink-light)',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
        }}
        aria-label={`添加到${group.store.name}`}
      >
        +
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 2: Wire up in List.tsx**

In `src/routes/List.tsx`, add state for preselected store:

```typescript
const [preselectedStore, setPreselectedStore] = useState<string | undefined>();
```

Update StoreCard rendering:

```tsx
<StoreCard
  key={group.store.id}
  group={group}
  customIconMap={customIconMap}
  onItemTap={(item) => nav(`/edit-item/${item.id}`)}
  onAddItem={(storeId) => {
    setPreselectedStore(storeId);
    setShowAdd(true);
  }}
  colorIndex={i}
/>
```

Reset preselected store when AddSheet closes:

```tsx
<AddSheet
  open={showAdd}
  uid={uid}
  listId={list.id}
  supermarkets={list.supermarkets}
  customIconMap={customIconMap}
  existingItemNames={existingItemNames}
  preselectedStore={preselectedStore}
  onClose={() => { setShowAdd(false); setPreselectedStore(undefined); }}
  onAdd={onAdd}
  onRemove={onRemoveAdded}
  onIconsChanged={refreshIcons}
  onOpenImport={() => { setShowAdd(false); setShowImport(true); }}
/>
```

- [ ] **Step 3: Verify in browser**

Check:
- Each StoreCard header has a "+" button (dashed circle)
- Tapping "+" on a StoreCard opens AddSheet
- The bottom "+ 添加物品" dashed area still works (opens AddSheet without preselection)
- No layout issues with the new button

- [ ] **Step 4: Commit**

```bash
git add src/components/StoreCard.tsx src/routes/List.tsx
git commit -m "feat: add '+' button to each StoreCard header

Each store card now has a dashed '+' button to add items directly
to that store. This opens the AddSheet with the store pre-selected.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 4C: Store-First AddSheet Flow

**Files:**
- Modify: `src/components/AddSheet.tsx`

- [ ] **Step 1: Add `preselectedStore` prop and store selection step**

In `src/components/AddSheet.tsx`:

1. Add prop to interface:
```typescript
interface Props {
  open: boolean;
  uid: string;
  listId: string;
  supermarkets: Store[];
  customIconMap: Map<string, string>;
  existingItemNames: Set<string>;
  preselectedStore?: string;
  onClose: () => void;
  onAdd: (input: NewItemInput) => Promise<string>;
  onRemove: (itemId: string) => Promise<void>;
  onIconsChanged: () => void | Promise<void>;
  onOpenImport?: () => void;
}
```

2. Update function signature:
```typescript
export function AddSheet({ open, uid, listId, supermarkets, customIconMap, existingItemNames, preselectedStore, onClose, onAdd, onRemove, onIconsChanged, onOpenImport }: Props) {
```

3. Add `storeChosen` state. When `preselectedStore` is provided, skip the selection step:

```typescript
const [storeChosen, setStoreChosen] = useState(false);
```

4. Update the open-reset useEffect to handle preselection:

In the existing `useEffect` that runs when `open` changes, update to:

```typescript
useEffect(() => {
  if (open) {
    setFrequent(getTopFrequentItems(uid, 12));
    setAddedItems(new Map());
    setAnimating(new Map());
    setBusy(new Set());
    setIconErrors(new Set());
    if (preselectedStore) {
      setSelectedMarket(preselectedStore);
      setStoreChosen(true);
    } else {
      setSelectedMarket('none');
      setStoreChosen(false);
    }
    getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
  }
}, [open, uid, preselectedStore]);
```

Wait — the existing useEffect uses `[open, uid]`. The `frequent` state was already removed in Task 2. Update: actually in Task 2 we removed the `frequent` state and the `setFrequent` call, so this useEffect already doesn't have that. Let me adjust. In the current code after Task 2 changes, the useEffect becomes:

```typescript
useEffect(() => {
  if (open) {
    setAddedItems(new Map());
    setAnimating(new Map());
    setBusy(new Set());
    setIconErrors(new Set());
    if (preselectedStore) {
      setSelectedMarket(preselectedStore);
      setStoreChosen(true);
    } else {
      setSelectedMarket('none');
      setStoreChosen(false);
    }
    getRemainingCredits(uid).then(setRemainingCredits).catch(() => {});
  }
}, [open, uid, preselectedStore]);
```

5. Add the store selection step inside the sheet, **replacing** the existing static store selector. The entire scrollable content area changes based on `storeChosen`:

When `!storeChosen`, show the store picker:

```tsx
{/* Store selection step */}
{!storeChosen && (
  <div className="flex-1 overflow-y-auto px-5 pb-8">
    <div className="text-center mb-6 mt-4">
      <div className="text-lg font-semibold" style={{ color: '#5a4e3c', fontFamily: 'var(--font-title)' }}>
        {t('addSheet.pickStore')}
      </div>
    </div>
    <div className="flex flex-col gap-3">
      {sortedSupermarkets.map(m => (
        <button
          key={m.id}
          onClick={() => {
            setSelectedMarket(m.id);
            setStoreChosen(true);
          }}
          className="w-full py-4 px-5 rounded-2xl text-left active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(255,252,247,0.7)',
            border: '1.5px solid rgba(215,205,188,0.4)',
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            color: '#5a4e3c',
          }}
        >
          {m.name}
        </button>
      ))}
    </div>
  </div>
)}
```

When `storeChosen`, show the existing items content (search + frequent + grid). Remove the old inline store selector pills. Add a small breadcrumb showing the selected store with a "change" option:

```tsx
{/* Selected store indicator + change */}
{storeChosen && (
  <>
    <div className="px-5 pb-2 flex items-center gap-2">
      <span
        className="text-xs font-medium px-3 py-1 rounded-full"
        style={{
          background: 'rgba(212,131,107,0.1)',
          color: 'var(--accent)',
          border: '1px solid rgba(212,131,107,0.25)',
        }}
      >
        {sortedSupermarkets.find(m => m.id === selectedMarket)?.name ?? t('addSheet.noStore')}
      </span>
      <button
        onClick={() => setStoreChosen(false)}
        className="text-xs active:opacity-60"
        style={{ color: '#a0937e' }}
      >
        {t('addSheet.changeStore')}
      </button>
    </div>

    {/* search bar ... (keep existing) */}
    {/* scrollable content ... (keep existing, but remove the old supermarket selector div) */}
  </>
)}
```

6. Remove the old static supermarket selector block (the `{/* supermarket selector */}` section with pill buttons around lines 438-466 in the original).

- [ ] **Step 2: Add new i18n keys**

In `src/locales/zh-CN.json`, add to `addSheet`:
```json
"pickStore": "你要去哪家店？",
"changeStore": "换一家"
```

In `src/locales/en.json`, add to `addSheet`:
```json
"pickStore": "Which store?",
"changeStore": "Change"
```

- [ ] **Step 3: Verify in browser**

Check flow A (from bottom "+" button):
- AddSheet opens showing "你要去哪家店？" with full-width store buttons
- Selecting a store transitions to the items view
- Selected store shows as a small pill at top with "换一家" link
- Tapping "换一家" goes back to store picker
- Items are added with the selected store

Check flow B (from StoreCard "+" button):
- AddSheet opens directly to items view (store pre-selected)
- Selected store pill shows the correct store name
- User can still tap "换一家" to change store

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/AddSheet.tsx src/locales/zh-CN.json src/locales/en.json
git commit -m "feat: store-first AddSheet flow with pre-selection

AddSheet now asks 'Which store?' before showing items, making the
store choice intentional rather than easy to miss. StoreCard '+'
buttons skip this step and pre-select their store. Users can tap
'Change' to switch stores at any time.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Final: Push

- [ ] **Push all commits**

```bash
git push origin main
```

---

## Summary of All Changes

| Commit | What changed |
|--------|-------------|
| 1 | AddSheet close button: "取消" → "完成" (green) |
| 2 | Merged duplicate frequent sections, "已在清单" for existing items |
| 3 | Optimistic updates — items appear instantly |
| 4a | Removed ItemMenu + SetIconSheet from main list, tap → EditItem |
| 4b | "+" button on each StoreCard header |
| 4c | Store-first AddSheet flow with pre-selection support |
