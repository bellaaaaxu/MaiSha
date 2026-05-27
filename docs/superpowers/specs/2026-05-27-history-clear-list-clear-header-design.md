# History Clearing, List Clearing, and Header Decongestion

## Overview

Three small UX fixes addressing mistap and missing-feature complaints:

1. **Clear purchase history** — single / multi-select / bulk delete (currently no way to delete history at all)
2. **Clear the entire shopping list** — one-tap "empty list" entry point
3. **Header decongestion** — "一起买" (share/invite) and ⚙ (settings) are 16px apart, causing mistaps

---

## 1. Clear Purchase History

### Current state

- `PurchaseHistory.tsx` lists past purchase records (history rows). No delete UI.
- `purchase_history` table has only SELECT and INSERT RLS policies — no DELETE policy at all, so even if a delete button existed it would silently fail.

### New state

**Database (new migration `007_purchase_history_delete.sql`):**

```sql
CREATE POLICY "Members can delete history" ON public.purchase_history
  FOR DELETE USING (
    list_id IN (SELECT id FROM public.lists WHERE auth.uid() = ANY(member_uids))
  );
```

Same membership check as items table — any list member can delete (confirmed with user).

**Library (`src/lib/purchase-history.ts`):**

```ts
export async function deletePurchaseHistory(ids: string[]): Promise<void>
```

Single function takes an array (1 → single delete; N → bulk). Uses `.in('id', ids)`.

**UI — `PurchaseHistory.tsx`:**

Add a "管理" button to the header area (right side, where the empty `<span className="w-10" />` placeholder currently is).

Two modes:

**Normal mode (default):**
- Each row stays a `<button>` that navigates to detail
- No swipe gesture (the codebase has no existing swipe pattern; adding one is more risk than value here). Single delete is achieved by entering management mode → selecting one → delete.

**Management mode (after tapping "管理"):**
- Header changes to: `[取消]   已选 N 项   [全选] [删除]`
- Each row gets a leading circular checkbox (reuse the style from `PurchaseHistoryDetail.tsx` lines 108-113)
- Tapping a row toggles selection (does NOT navigate)
- "删除" button triggers `ConfirmModal`. Copy depends on count:
  - 1 selected → "确定删除这条记录吗？"
  - N selected → "确定删除 N 条记录吗？"
- After delete: exit management mode, refresh

### Where the data refreshes

`usePurchaseHistory` already exposes `refresh()`. Call it after delete completes.

### Edge cases

- Empty history → "管理" button hidden
- Management mode with 0 selected → "删除" button disabled / dimmed
- Spending statistics block is hidden in management mode (cleaner focus)

---

## 2. Clear Entire Shopping List

### Current state

The only way to clear all items is to enter shopping mode → end shopping → "全部清除". No direct entry point.

User confirmed: "清空清单" = delete all items (regardless of checked state), **keep** supermarket categories.

### New state

**Library (`src/lib/db.ts`):**

```ts
export async function clearAllItems(listId: string): Promise<number>
```

Backed by a new RPC `clear_all_items(p_list_id uuid)` for symmetry with existing `clear_checked`. Deletes from items where list_id = p_list_id (all rows, regardless of `checked`). Returns count.

New migration: `008_clear_all_items.sql`.

**UI — `SettingsDrawer.tsx`:**

Add a new entry at the **bottom** of the items list, visually separated:

```
语言
图标库
导入导出
个人偏好
隐私
联系我们
─── (dashed separator with more vertical space) ───
清空清单    ← warm orange tint, not red
```

Tap → `ConfirmModal` "确定清空所有商品吗？超市分类会保留" → on confirm, call `clearAllItems`, close drawer, show `UndoToast` "已清空清单"? **No** — destructive multi-row delete is not undoable with the current `useUndoToast` (single-item only). Skip undo for now; the confirm modal is the safeguard.

Use color `#c97b63` (the existing warm orange used in purchase amount displays) for the label, not red, to match the watercolor aesthetic.

### Edge cases

- List already empty → still allow the action (no-op delete returns 0); could disable the button when items.length === 0. **Disable when empty.** Requires passing item count to `SettingsDrawer` — small prop addition.

---

## 3. Header Decongestion

### Current state

`List.tsx` lines 156-184:

```
[买啥]              [一起买]  [⚙]
                       ↑       ↑
                       16px gap — mistap zone
```

Both are in a right-aligned flex with `gap: 16`. The ⚙ icon (settings) opens `SettingsDrawer` which slides in **from the left**. The visual direction is inconsistent with the trigger position.

### New state

```
[≡]  [买啥]                     [一起买]
 ↑                                ↑
 hamburger,                       only button on right —
 opens left-side drawer           large hit area, no neighbor
```

**Changes:**

- Move ⚙ from right group to a new left button **before** the title
- Change the glyph from ⚙ to ≡ (hamburger), since it now triggers a side drawer and that's the universal convention
- Right side has only "一起买" → no adjacent button → impossible to mistap
- Drawer direction (left) now matches trigger position (left) → consistent mental model

**Layout sketch:**

```
padding: 16px 24px 12px;
display: flex;
align-items: center;
gap: 12px;  /* between hamburger and title */

[≡]  [买啥]                            [一起买]
                  ↑ flex: 1 spacer
```

Hamburger button: same `var(--ink-light)` color, font-size ~22, padding to give a comfortable hit target (~40×40).

### Why not just add more gap?

Considered. Treats symptoms, not root cause. The two buttons next to each other in the same right cluster suggests they're related ("一起买 settings"), which they aren't. Separating them communicates "different things" at the visual level too.

---

## Files Touched

**New:**
- `supabase/migrations/007_purchase_history_delete.sql`
- `supabase/migrations/008_clear_all_items.sql`

**Modified:**
- `src/lib/purchase-history.ts` — add `deletePurchaseHistory`
- `src/lib/db.ts` — add `clearAllItems`
- `src/hooks/usePurchaseHistory.ts` — no signature change, just relied-on refresh
- `src/routes/PurchaseHistory.tsx` — add management mode + swipe-to-delete
- `src/components/SettingsDrawer.tsx` — add "清空清单" entry, accept new props for item count + handler
- `src/routes/List.tsx` — restructure header (hamburger on left), wire up clear-list handler to SettingsDrawer

## Out of Scope

- Undo for clear-list (would need bulk undo support — separate task)
- Deleting individual items inside a single purchase history detail (different feature; user's "单个" referred to history records, confirmed)
- Per-user permission restrictions on delete (any list member can delete — confirmed with user)

## Translation Keys

New keys needed in `zh-CN.json`, `zh-TW.json`, `en.json`:
- `history.manage` — 管理 / 管理 / Manage
- `history.cancel` — 取消 / 取消 / Cancel
- `history.selectAll` — 全选 / 全選 / Select all
- `history.deselectAll` — 取消全选 / 取消全選 / Deselect all
- `history.delete` — 删除 / 刪除 / Delete
- `history.selectedCount` — 已选 {{n}} 项 / 已選 {{n}} 項 / {{n}} selected
- `history.confirmDeleteOne` — 确定删除这条记录吗？/ ... / Delete this record?
- `history.confirmDeleteMany` — 确定删除 {{n}} 条记录吗？/ ... / Delete {{n}} records?
- `settings.clearList` — 清空清单 / 清空清單 / Clear list
- `settings.confirmClearList` — 确定清空所有商品吗？超市分类会保留 / ... / Clear all items? Stores will be kept.
