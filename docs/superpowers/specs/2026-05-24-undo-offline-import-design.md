# Undo Toast + Offline Queue + Text Import — Design Spec

## Feature 1: Undo Toast

### Problem
Delete and check operations use browser `confirm()` dialogs that break flow, especially during fast grocery shopping.

### Solution
Replace `confirm()` with a bottom toast showing "已删除「X」" / "已勾选「X」" with a 5-second undo button.

### New files
- `src/components/UndoToast.tsx` — Toast UI component (slide-up, warm dark background, green undo button)
- `src/hooks/useUndoToast.ts` — Toast state management (single toast, new replaces old)

### Behavior
- **Delete item**: Immediately call `deleteItem()`, show toast. Undo re-inserts with `addItem()`.
- **Check item**: Immediately call `updateItem({ checked: true })`, show toast. Undo unchecks. Unchecking does NOT show toast.
- **Toast**: 5s auto-dismiss, positioned above footer buttons, z-40.
- **ConfirmModal stays** for batch "清空已购" — too destructive for undo.

### Files modified
- `src/routes/List.tsx` — Replace `confirm()` in `onMenuDelete`, add toast to `onToggle`

---

## Feature 2: Offline Queue

### Problem
Users lose edits when checking items or adding items in supermarket basements with no signal.

### Solution
Detect offline state, queue add/check operations in IndexedDB, replay on reconnect.

### New files
- `src/lib/offline-queue.ts` — IndexedDB queue (native API, no library). Operations: `{ type: 'add'|'check', payload, timestamp, localId }`.
- `src/hooks/useOffline.ts` — `{ isOffline }` from `navigator.onLine` + events.

### Behavior
- **Offline add**: Generate `local-{uuid}` ID, insert into local items state, queue operation. On reconnect, `addItem()` to Supabase, replace local ID with real ID.
- **Offline check**: Toggle locally, queue `updateItem()`. On reconnect, replay.
- **Flush**: `online` event triggers sequential replay. Errors are retried once, then dropped with console warning.
- **UI indicator**: Header shows "📡 离线模式" badge when offline.

### Scope
- Only `add` and `check` operations. Delete/edit require network.
- No conflict resolution — last-write-wins via Supabase (acceptable for family use).

### Files modified
- `src/lib/db.ts` — Wrap `addItem`/`updateItem` with offline-aware layer
- `src/hooks/useItems.ts` — Merge offline items, flush on reconnect
- `src/routes/List.tsx` — Show offline indicator in header

---

## Feature 3: Text Import

### Problem
Users receive grocery lists via WeChat messages and must manually add items one by one.

### Solution
Paste multi-line text, auto-parse into structured items with quantity detection and category matching.

### New files
- `src/utils/parse-import-text.ts` — Line splitter + quantity regex + category matcher
- `src/components/ImportSheet.tsx` — Bottom sheet with textarea, live preview, supermarket selector, import button

### Parse rules
1. Split by newline, filter empty lines
2. Strip prefixes: `- `, `• `, `· `, `1. `, `① `, etc.
3. Extract quantity from tail: `×2`, `x3`, `2盒`, `3包`, `1瓶`, `500g`, `2斤`
4. Remaining text = item name, run through `matchCategory()`
5. Return `NewItemInput[]`

### Entry points
- `MoreMenu.tsx` — New "📥 粘贴导入" menu item, opens ImportSheet
- `AddSheet.tsx` — Small 📋 button next to search input, opens ImportSheet

### Behavior
- Textarea with placeholder showing example format
- Real-time preview: parsed items displayed as chips/list below textarea
- Supermarket selector (defaults to "未分类")
- "导入 N 项" button calls `addItem()` for each parsed item
- After import, closes sheet and shows undo toast "已导入 N 项"

### Files modified
- `src/components/MoreMenu.tsx` — Add import menu item + onImport callback
- `src/components/AddSheet.tsx` — Add paste button near search input
- `src/routes/List.tsx` — Wire up ImportSheet state and handler
