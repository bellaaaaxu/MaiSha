# History Clear, List Clear, Header Decongestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UX issues — add purchase history deletion (single/multi/all via management mode), add one-tap "clear list" in settings drawer, and move ⚙ to the left as a hamburger to stop mistaps with "一起买".

**Architecture:** Database changes via two new SQL migrations (DELETE RLS policy on `purchase_history`, new RPC `clear_all_items`). Library functions wrap them. UI changes: a stateful "management mode" in `PurchaseHistory.tsx`, a destructive-tinted entry in `SettingsDrawer.tsx`, and a header restructure in `List.tsx`.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres + RLS), Tailwind, react-i18next, vitest (only utils have unit tests). No swipe-gesture library — single delete is achieved via management mode with 1 selected.

**Spec:** [docs/superpowers/specs/2026-05-27-history-clear-list-clear-header-design.md](../specs/2026-05-27-history-clear-list-clear-header-design.md)

---

### Task 1: Add DELETE policy migration for purchase_history

**Files:**
- Create: `supabase/migrations/007_purchase_history_delete.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/007_purchase_history_delete.sql`:

```sql
-- 007_purchase_history_delete.sql
-- Allow list members to delete their purchase history records.

CREATE POLICY "Members can delete history" ON public.purchase_history
  FOR DELETE USING (
    list_id IN (
      SELECT id FROM public.lists WHERE auth.uid() = ANY(member_uids)
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/007_purchase_history_delete.sql
git commit -m "feat(db): allow members to delete purchase history"
```

Note: The user will run this migration in Supabase Studio after merging — see the final handoff notes.

---

### Task 2: Add clear_all_items RPC migration

**Files:**
- Create: `supabase/migrations/008_clear_all_items.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/008_clear_all_items.sql`. Follow the existing `clear_checked` pattern from `001_initial_schema.sql:106-128`:

```sql
-- 008_clear_all_items.sql
-- RPC to delete all items in a list (regardless of checked state).
-- Supermarket categories on the list itself are preserved.

CREATE OR REPLACE FUNCTION clear_all_items(p_list_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lists WHERE id = p_list_id AND auth.uid() = ANY(member_uids)) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  DELETE FROM items WHERE list_id = p_list_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/008_clear_all_items.sql
git commit -m "feat(db): add clear_all_items RPC"
```

---

### Task 3: Add deletePurchaseHistory library function

**Files:**
- Modify: `src/lib/purchase-history.ts`

- [ ] **Step 1: Append the function**

Add at the bottom of `src/lib/purchase-history.ts`:

```ts
export async function deletePurchaseHistory(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('purchase_history')
    .delete()
    .in('id', ids);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/purchase-history.ts
git commit -m "feat: add deletePurchaseHistory"
```

---

### Task 4: Add clearAllItems library function

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Append the function**

Add at the bottom of `src/lib/db.ts` (after `updateListSupermarkets` on line 113):

```ts
export async function clearAllItems(listId: string): Promise<number> {
  const { data, error } = await supabase.rpc('clear_all_items', { p_list_id: listId });
  if (error) throw error;
  return data as number;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add clearAllItems"
```

---

### Task 5: Add i18n keys for new strings

**Files:**
- Modify: `src/locales/zh-CN.json`
- Modify: `src/locales/zh-TW.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Update `src/locales/zh-CN.json`**

Add to the `history` section (create the section if it doesn't exist — currently only `nav.history` exists; we need a new top-level `history` block). Insert after the existing `shopping` block, before `addSheet`:

```json
  "history": {
    "manage": "管理",
    "cancel": "取消",
    "selectAll": "全选",
    "deselectAll": "取消全选",
    "delete": "删除",
    "selectedCount": "已选 {{n}} 项",
    "confirmDeleteOne": "确定删除这条记录吗？",
    "confirmDeleteMany": "确定删除 {{n}} 条记录吗？"
  },
```

Add to the existing `settings` block (after `contact`):

```json
    "clearList": "清空清单",
    "confirmClearList": "确定清空所有商品吗？超市分类会保留"
```

(Don't forget to add a comma after `"contact": "联系我们"` since new keys follow it.)

- [ ] **Step 2: Update `src/locales/zh-TW.json`**

Add the same `history` section with Traditional Chinese:

```json
  "history": {
    "manage": "管理",
    "cancel": "取消",
    "selectAll": "全選",
    "deselectAll": "取消全選",
    "delete": "刪除",
    "selectedCount": "已選 {{n}} 項",
    "confirmDeleteOne": "確定刪除這條記錄嗎？",
    "confirmDeleteMany": "確定刪除 {{n}} 條記錄嗎？"
  },
```

And to `settings`:

```json
    "clearList": "清空清單",
    "confirmClearList": "確定清空所有商品嗎？超市分類會保留"
```

- [ ] **Step 3: Update `src/locales/en.json`**

Add the same `history` section in English:

```json
  "history": {
    "manage": "Manage",
    "cancel": "Cancel",
    "selectAll": "Select all",
    "deselectAll": "Deselect all",
    "delete": "Delete",
    "selectedCount": "{{n}} selected",
    "confirmDeleteOne": "Delete this record?",
    "confirmDeleteMany": "Delete {{n}} records?"
  },
```

And to `settings`:

```json
    "clearList": "Clear list",
    "confirmClearList": "Clear all items? Stores will be kept."
```

- [ ] **Step 4: Verify JSON is valid**

Run: `npm run typecheck`
Expected: no errors (the JSON files are imported via Vite, malformed JSON would break the import).

- [ ] **Step 5: Commit**

```bash
git add src/locales/zh-CN.json src/locales/zh-TW.json src/locales/en.json
git commit -m "feat(i18n): add history-manage and clear-list strings"
```

---

### Task 6: Add management mode to PurchaseHistory.tsx

**Files:**
- Modify: `src/routes/PurchaseHistory.tsx` (full rewrite, ~180 lines)

This is the largest change. Build it in one go since the management mode touches every part of the existing render.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `src/routes/PurchaseHistory.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { deletePurchaseHistory } from '@/lib/purchase-history';
import { formatAmount, getOrDetectCurrency } from '@/utils/currency';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function PurchaseHistory() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { history, loading, refresh } = usePurchaseHistory(list?.id ?? null);

  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const spending = useMemo(() => {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let week = 0, month = 0, total = 0;
    let count = 0;
    for (const h of history) {
      if (h.amount == null) continue;
      const d = new Date(h.completed_at);
      total += h.amount;
      count++;
      if (d >= thisMonthStart) month += h.amount;
      if (d >= thisWeekStart) week += h.amount;
    }
    return { week, month, total, count };
  }, [history]);

  const currency = getOrDetectCurrency();
  const allSelected = history.length > 0 && selected.size === history.length;

  const enterManage = () => {
    setManageMode(true);
    setSelected(new Set());
  };

  const exitManage = () => {
    setManageMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(history.map(h => h.id)));
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await deletePurchaseHistory(Array.from(selected));
      await refresh();
      exitManage();
    } catch {
      alert('删除失败');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const confirmMessage = selected.size === 1
    ? t('history.confirmDeleteOne')
    : t('history.confirmDeleteMany', { n: selected.size });

  return (
    <div className="min-h-screen page-enter" style={{ background: '#faf6f0' }}>
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10"
        style={{
          background: 'rgba(250,246,240,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(215,205,188,0.3)',
        }}
      >
        {manageMode ? (
          <>
            <button onClick={exitManage} className="text-sm" style={{ color: '#a0937e' }}>
              {t('history.cancel')}
            </button>
            <span className="flex-1 text-center text-sm font-semibold" style={{ color: '#5a4e3c' }}>
              {t('history.selectedCount', { n: selected.size })}
            </span>
            <button onClick={toggleSelectAll} className="text-sm mr-3" style={{ color: '#7ca982' }}>
              {allSelected ? t('history.deselectAll') : t('history.selectAll')}
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold"
              style={{
                color: selected.size === 0 ? '#d5cbbe' : '#c97b63',
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              {t('history.delete')}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
            <span className="flex-1 text-center text-base font-semibold" style={{ color: '#5a4e3c' }}>购物历史</span>
            {history.length > 0 ? (
              <button onClick={enterManage} className="text-sm" style={{ color: '#7ca982' }}>
                {t('history.manage')}
              </button>
            ) : (
              <span className="w-10" />
            )}
          </>
        )}
      </header>

      <main className="p-4">
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#a0937e' }}>加载中…</div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm" style={{ color: '#a0937e' }}>还没有购物记录</div>
            <div className="text-xs mt-1" style={{ color: '#c4b49a' }}>完成一次购物后会自动记录~</div>
          </div>
        ) : (
          <>
            {!manageMode && spending.count > 0 && (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: 'rgba(124,169,130,0.08)', border: '1px solid rgba(124,169,130,0.2)' }}
              >
                <div className="text-xs font-medium mb-2.5" style={{ color: '#7a6e5d' }}>消费统计</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px]" style={{ color: '#a0937e' }}>本周</div>
                    <div className="text-lg font-bold" style={{ color: '#5a4e3c' }}>
                      {formatAmount(spending.week, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: '#a0937e' }}>本月</div>
                    <div className="text-lg font-bold" style={{ color: '#5a4e3c' }}>
                      {formatAmount(spending.month, currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {history.map(h => {
                const isSelected = selected.has(h.id);
                return (
                  <button
                    key={h.id}
                    onClick={() => manageMode ? toggleSelect(h.id) : nav(`/history/${h.id}`)}
                    className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-transform flex items-center gap-3"
                    style={{
                      background: isSelected ? 'rgba(124,169,130,0.08)' : 'rgba(255,252,247,0.6)',
                      border: isSelected ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.35)',
                    }}
                  >
                    {manageMode && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected ? '#7ca982' : 'transparent',
                          border: isSelected ? 'none' : '2px solid #d5cbbe',
                        }}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
                          {h.supermarket_name}
                        </span>
                        <div className="flex items-center gap-2">
                          {h.amount != null && (
                            <span className="text-sm font-semibold" style={{ color: '#c97b63' }}>
                              {formatAmount(h.amount, currency)}
                            </span>
                          )}
                          <span className="text-xs" style={{ color: '#c4b49a' }}>
                            {new Date(h.completed_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: '#a0937e' }}>
                        共 {h.total_count} 样 · 买了 {h.bought_count} 样
                        {h.total_count - h.bought_count > 0 && (
                          <span> · 漏了 {h.total_count - h.bought_count} 样</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      <ConfirmModal
        open={confirmOpen}
        title={t('history.delete')}
        message={confirmMessage}
        confirmText={deleting ? '删除中…' : t('history.delete')}
        cancelText={t('history.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/PurchaseHistory.tsx
git commit -m "feat: add management mode to purchase history for single/multi/all delete"
```

---

### Task 7: Add "清空清单" to SettingsDrawer

**Files:**
- Modify: `src/components/SettingsDrawer.tsx`
- Modify: `src/routes/List.tsx` (pass new props)

- [ ] **Step 1: Update SettingsDrawer.tsx**

Replace the contents of `src/components/SettingsDrawer.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  open: boolean;
  itemCount: number;
  onClose: () => void;
  onClearList: () => Promise<void>;
}

export function SettingsDrawer({ open, itemCount, onClose, onClearList }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const items = [
    { label: t('settings.language'), action: () => nav('/settings/language') },
    { label: t('settings.iconLibrary'), action: () => nav('/icons') },
    { label: t('settings.importExport'), action: () => nav('/settings/import-export') },
    { label: t('settings.personalPresets'), action: () => nav('/manage-stores') },
    { label: t('settings.privacy'), action: () => nav('/privacy') },
    { label: t('settings.contact'), action: () => window.open('mailto:support@maisha.app') },
  ];

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearList();
      setConfirmOpen(false);
      onClose();
    } catch {
      alert('清空失败');
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            zIndex: 999, transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 280,
        background: 'var(--paper)',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,0.1)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 1000,
        padding: '60px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-title)',
          fontSize: 24,
          color: 'var(--ink)',
          marginBottom: 24,
        }}>
          {t('settings.title')}
        </h2>

        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              fontWeight: 400,
              color: 'var(--ink)',
              background: 'none',
              border: 'none',
              borderBottom: '1px dashed rgba(196, 180, 154, 0.3)',
              padding: '16px 0',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}

        {/* Clear list — destructive, separated by extra spacing */}
        <button
          onClick={() => itemCount > 0 && setConfirmOpen(true)}
          disabled={itemCount === 0}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 500,
            color: itemCount === 0 ? '#d5cbbe' : '#c97b63',
            background: 'none',
            border: 'none',
            padding: '16px 0',
            marginTop: 24,
            textAlign: 'left',
            cursor: itemCount === 0 ? 'not-allowed' : 'pointer',
            opacity: itemCount === 0 ? 0.6 : 1,
          }}
        >
          {t('settings.clearList')}
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('settings.clearList')}
        message={t('settings.confirmClearList')}
        confirmText={clearing ? '清空中…' : t('settings.clearList')}
        cancelText={t('history.cancel')}
        onConfirm={handleClear}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: Wire up the new props in List.tsx**

In `src/routes/List.tsx`, add the `clearAllItems` import to the existing import line and use it. Find this import block (around line 26):

```ts
import { addItem, updateItem, deleteItem } from '@/lib/db';
```

Change it to:

```ts
import { addItem, updateItem, deleteItem, clearAllItems } from '@/lib/db';
```

Find the SettingsDrawer usage (around line 311):

```tsx
<SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
```

Replace with:

```tsx
<SettingsDrawer
  open={showSettings}
  itemCount={items.length}
  onClose={() => setShowSettings(false)}
  onClearList={async () => {
    await clearAllItems(list.id);
  }}
/>
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsDrawer.tsx src/routes/List.tsx
git commit -m "feat: add clear list entry to settings drawer"
```

---

### Task 8: Restructure List.tsx header (hamburger left, joinList right)

**Files:**
- Modify: `src/routes/List.tsx`

- [ ] **Step 1: Replace the header block**

In `src/routes/List.tsx`, find the header div (lines 156-184). It currently looks like:

```tsx
        {/* Header */}
        <div style={{
          padding: '16px 24px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-title)',
            fontSize: 34,
            color: 'var(--ink)',
            letterSpacing: 3,
          }}>
            {t('app.title')}
          </span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={onShareMenu} style={{
              fontFamily: 'var(--font-body)', fontSize: 15,
              color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              {t('header.joinList')}
            </button>
            <button onClick={() => setShowSettings(true)} style={{
              fontSize: 20, color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              ⚙
            </button>
          </div>
        </div>
```

Replace it with:

```tsx
        {/* Header */}
        <div style={{
          padding: '16px 24px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t('settings.title')}
            style={{
              fontSize: 22,
              color: 'var(--ink-light)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
              marginLeft: -4,
            }}
          >
            ≡
          </button>
          <span style={{
            fontFamily: 'var(--font-title)',
            fontSize: 34,
            color: 'var(--ink)',
            letterSpacing: 3,
            flex: 1,
          }}>
            {t('app.title')}
          </span>
          <button onClick={onShareMenu} style={{
            fontFamily: 'var(--font-body)', fontSize: 15,
            color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px',
          }}>
            {t('header.joinList')}
          </button>
        </div>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/List.tsx
git commit -m "feat: move settings to left as hamburger to prevent mistap with 一起买"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: all existing tests pass (no new ones added; this confirms nothing was broken).

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 4: Push the branch**

```bash
git push
```

If on a feature branch, push with `-u origin <branch>` the first time.

---

## Self-Review

**Spec coverage:**

| Spec section | Implemented in |
|---|---|
| `purchase_history` DELETE RLS policy | Task 1 |
| `deletePurchaseHistory(ids)` lib | Task 3 |
| `clearAllItems` RPC + lib | Tasks 2, 4 |
| History "管理" mode (multi-select, select-all, delete) | Task 6 |
| Single-record delete via mgmt mode (no swipe) | Task 6 |
| `ConfirmModal` for delete with count-aware copy | Task 6 |
| Spending stats hidden in mgmt mode | Task 6 (`!manageMode && spending.count > 0`) |
| Delete disabled with 0 selected | Task 6 |
| "管理" hidden when history empty | Task 6 |
| "清空清单" entry in SettingsDrawer, warm orange | Task 7 |
| Disabled when items.length === 0 | Task 7 (`itemCount === 0`) |
| ConfirmModal for clear-list | Task 7 |
| Hamburger ≡ on left, joinList alone on right | Task 8 |
| New i18n keys (zh-CN, zh-TW, en) | Task 5 |

All spec items covered.

**Placeholder scan:** No "TBD", no vague instructions. Every code step has the full code.

**Type consistency:** `deletePurchaseHistory(ids: string[])` returns `Promise<void>` — consistent. `clearAllItems(listId)` returns `Promise<number>` — consistent. `SettingsDrawer` props (`itemCount`, `onClearList`) match in declaration and call site (Task 7 step 1 and step 2). Glyph is `≡` (U+2261) — used identically in spec and plan.

---

## Execution Notes

- Plan is **9 tasks**, each ending in a commit. Total ~9 commits.
- TDD is **not** used in this plan — the codebase has unit tests only for pure utility functions (`utils/__tests__/`). DB and UI changes are verified via typecheck + manual smoke test, matching project convention.
- After implementation, the user must:
  1. Apply migrations `007_purchase_history_delete.sql` and `008_clear_all_items.sql` in Supabase Studio (these don't auto-run).
  2. Manually smoke-test in the dev server (`npm run dev`): clear history (single + multi + all), clear the entire list, verify the hamburger triggers the drawer and there's no neighbor next to "一起买".
