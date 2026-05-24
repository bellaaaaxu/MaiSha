# MaiSha App Store Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 of MaiSha's App Store optimization: Shopping Mode, warm copy, micro-animations, purchase history, frequently-bought, and brand icon audit.

**Architecture:** Add a full-screen Shopping Mode view (large icon grid, per-supermarket), a purchase history system backed by a new Supabase table, and polish the entire UI with warm Japanese-watercolor-themed copy and organic micro-animations. Frequently-bought items are derived client-side from purchase history.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS, Supabase (Postgres + Realtime), react-router-dom v6, @dnd-kit, Vitest

**Spec:** `docs/superpowers/specs/2026-05-24-app-store-optimization-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/routes/ShoppingMode.tsx` | Full-screen shopping mode with large icon grid, progress bar, category sections |
| `src/components/ShoppingEndModal.tsx` | Modal shown when ending shopping (missed items / celebration) |
| `src/routes/PurchaseHistory.tsx` | History list page — shows past shopping sessions |
| `src/routes/PurchaseHistoryDetail.tsx` | Single history record — view items, re-add to list |
| `src/types/purchase-history.ts` | TypeScript interfaces for purchase history |
| `src/lib/purchase-history.ts` | Supabase CRUD for purchase_history table |
| `src/hooks/usePurchaseHistory.ts` | React hook for fetching purchase history |
| `src/utils/frequently-bought.ts` | Calculate frequently-bought items from history |
| `src/utils/warm-copy.ts` | Warm, conversational copy text constants |
| `supabase/migrations/20260524_purchase_history.sql` | Database migration |
| `tests/utils/frequently-bought.test.ts` | Tests for frequently-bought calculation |
| `tests/utils/warm-copy.test.ts` | Tests for warm copy helpers |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.tsx` | Add routes: `/shopping/:marketId`, `/history`, `/history/:id` |
| `src/components/SupermarketCard.tsx` | Add "去购物" button |
| `src/components/AddSheet.tsx` | Add "常买" section above frequent items |
| `src/routes/List.tsx` | Update copy to warm text, add history entry in MoreMenu |
| `src/components/MoreMenu.tsx` | Add "购物历史" menu item |
| `src/index.css` | Add new animation keyframes |
| `src/lib/db.ts` | Export `clearChecked` return type, no other changes |

---

## Task 1: Purchase History Data Layer

**Files:**
- Create: `supabase/migrations/20260524_purchase_history.sql`
- Create: `src/types/purchase-history.ts`
- Create: `src/lib/purchase-history.ts`
- Create: `src/hooks/usePurchaseHistory.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260524_purchase_history.sql
create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  supermarket_id text not null,
  supermarket_name text not null,
  items_snapshot jsonb not null default '[]',
  total_count int not null default 0,
  bought_count int not null default 0,
  completed_at timestamptz not null default now()
);

alter table public.purchase_history enable row level security;

create policy "Members can read history" on public.purchase_history
  for select using (
    list_id in (
      select id from public.lists where member_uids @> array[auth.uid()]
    )
  );

create policy "Members can insert history" on public.purchase_history
  for insert with check (
    list_id in (
      select id from public.lists where member_uids @> array[auth.uid()]
    )
  );

create index idx_purchase_history_list on public.purchase_history(list_id, completed_at desc);
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL Editor or via CLI:
```bash
npx supabase db push
```

- [ ] **Step 3: Create purchase history types**

```typescript
// src/types/purchase-history.ts
export interface HistoryItemSnapshot {
  name: string;
  quantity: string;
  note: string;
  category: string;
  category_emoji: string;
  checked: boolean;
}

export interface PurchaseHistory {
  id: string;
  list_id: string;
  supermarket_id: string;
  supermarket_name: string;
  items_snapshot: HistoryItemSnapshot[];
  total_count: number;
  bought_count: number;
  completed_at: string;
}
```

- [ ] **Step 4: Create purchase history DB functions**

```typescript
// src/lib/purchase-history.ts
import { supabase } from './supabase';
import type { PurchaseHistory, HistoryItemSnapshot } from '@/types/purchase-history';

export async function savePurchaseHistory(
  listId: string,
  supermarketId: string,
  supermarketName: string,
  items: HistoryItemSnapshot[]
): Promise<PurchaseHistory> {
  const bought = items.filter(i => i.checked).length;
  const { data, error } = await supabase
    .from('purchase_history')
    .insert({
      list_id: listId,
      supermarket_id: supermarketId,
      supermarket_name: supermarketName,
      items_snapshot: items,
      total_count: items.length,
      bought_count: bought,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PurchaseHistory;
}

export async function fetchPurchaseHistory(
  listId: string,
  limit = 50
): Promise<PurchaseHistory[]> {
  const { data, error } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('list_id', listId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PurchaseHistory[];
}

export async function fetchPurchaseHistoryById(
  id: string
): Promise<PurchaseHistory | null> {
  const { data, error } = await supabase
    .from('purchase_history')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PurchaseHistory | null;
}
```

- [ ] **Step 5: Create usePurchaseHistory hook**

```typescript
// src/hooks/usePurchaseHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchPurchaseHistory } from '@/lib/purchase-history';
import type { PurchaseHistory } from '@/types/purchase-history';

export function usePurchaseHistory(listId: string | null) {
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const data = await fetchPurchaseHistory(listId);
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { history, loading, refresh };
}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```
Expected: PASS (new files compile cleanly, not yet imported anywhere)

- [ ] **Step 7: Commit**

```bash
git add supabase/ src/types/purchase-history.ts src/lib/purchase-history.ts src/hooks/usePurchaseHistory.ts
git commit -m "feat: add purchase history data layer (types, DB, hook)"
```

---

## Task 2: Shopping Mode — Route & Entry Point

**Files:**
- Create: `src/routes/ShoppingMode.tsx` (skeleton)
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/SupermarketCard.tsx` (add "去购物" button)

- [ ] **Step 1: Create ShoppingMode route skeleton**

```typescript
// src/routes/ShoppingMode.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';

export default function ShoppingMode() {
  const { marketId } = useParams<{ marketId: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);
  const { iconMap: customIconMap } = useCustomIcons(list?.id ?? null);

  const supermarket = list?.supermarkets.find(s => s.id === marketId);
  const marketItems = items.filter(i => i.supermarket === marketId);
  const uncategorizedItems = items.filter(i => i.supermarket === 'none');

  if (!supermarket || !list) {
    return <div className="p-8 text-center" style={{ color: '#a0937e' }}>加载中…</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: '#faf6f0' }}>
      <div className="p-4 text-center" style={{ color: '#5a4e3c' }}>
        Shopping Mode: {supermarket.name} — {marketItems.length} 件物品
      </div>
      <button onClick={() => nav(-1)} className="ml-4 text-sm" style={{ color: '#999' }}>
        ← 返回
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, add the import and route inside the authenticated routes:

```typescript
import ShoppingMode from '@/routes/ShoppingMode';
```

Add route alongside existing routes (after `/icons`):
```tsx
<Route path="/shopping/:marketId" element={<ShoppingMode />} />
```

- [ ] **Step 3: Add "去购物" button to SupermarketCard**

In `src/components/SupermarketCard.tsx`, add `useNavigate` import and a button.

Add import:
```typescript
import { useNavigate } from 'react-router-dom';
```

Inside the component, before the return:
```typescript
const nav = useNavigate();
```

Replace the header button section. After the existing `<span>· {group.totalCount}项</span>`, add a "去购物" button. The full header `<>` fragment becomes:

```tsx
<>
  <span className="text-xs ml-1" style={{ color: '#a0937e' }}>· {group.totalCount}项</span>
  <span className="ml-auto flex items-center gap-2">
    <button
      onClick={(e) => {
        e.stopPropagation();
        nav(`/shopping/${group.supermarket.id}`);
      }}
      className="px-3 py-1 rounded-full text-xs font-medium text-white active:opacity-80"
      style={{ background: '#7ca982' }}
    >
      🛒 去购物
    </button>
    <span className="text-xs" style={{ color: '#c4b49a' }}>{collapsed ? '▸' : '▾'}</span>
  </span>
</>
```

- [ ] **Step 4: Run dev server and verify navigation works**

```bash
npm run dev
```

Open http://localhost:5173, verify:
1. Each non-empty supermarket card shows a "去购物" button
2. Clicking it navigates to `/shopping/{marketId}`
3. The skeleton page shows supermarket name and item count
4. Back button returns to list

- [ ] **Step 5: Commit**

```bash
git add src/routes/ShoppingMode.tsx src/App.tsx src/components/SupermarketCard.tsx
git commit -m "feat: add shopping mode route skeleton and entry button"
```

---

## Task 3: Shopping Mode — Grid Layout & Progress Bar

**Files:**
- Modify: `src/routes/ShoppingMode.tsx`

- [ ] **Step 1: Implement full ShoppingMode layout**

Replace the skeleton in `src/routes/ShoppingMode.tsx` with the full implementation:

```typescript
// src/routes/ShoppingMode.tsx
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { updateItem } from '@/lib/db';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { ShoppingEndModal } from '@/components/ShoppingEndModal';
import { UNDELETABLE_SUPERMARKET_ID } from '@/utils/constants';
import type { Item, CategoryKey } from '@/types/item';

const CATEGORY_COLORS: Record<string, string> = {
  '蔬菜': '#7ca982', '肉蛋': '#c97b63', '乳制品': '#d4a96a',
  '主食': '#8b9dc3', '调料': '#b08d57', '日用': '#9b8ec0',
  '烘焙': '#c9886d', '饮料': '#6a9fb5', '水果': '#d4a06a',
  '零食': '#c98a8a', '其他': '#999',
};

interface CategorySection {
  category: CategoryKey;
  emoji: string;
  items: Item[];
}

function groupByCategory(items: Item[]): CategorySection[] {
  const order: CategoryKey[] = [];
  const map = new Map<CategoryKey, CategorySection>();
  for (const item of items) {
    if (!map.has(item.category)) {
      order.push(item.category);
      map.set(item.category, { category: item.category, emoji: item.category_emoji, items: [] });
    }
    map.get(item.category)!.items.push(item);
  }
  return order.map(k => map.get(k)!);
}

export default function ShoppingMode() {
  const { marketId } = useParams<{ marketId: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { items } = useItems(list?.id ?? null);
  const { iconMap: customIconMap } = useCustomIcons(list?.id ?? null);
  const [showEndModal, setShowEndModal] = useState(false);

  const supermarket = list?.supermarkets.find(s => s.id === marketId);
  const marketItems = useMemo(
    () => items.filter(i => i.supermarket === marketId),
    [items, marketId]
  );
  const uncategorizedItems = useMemo(
    () => marketId !== UNDELETABLE_SUPERMARKET_ID
      ? items.filter(i => i.supermarket === UNDELETABLE_SUPERMARKET_ID && !i.checked)
      : [],
    [items, marketId]
  );

  const unchecked = marketItems.filter(i => !i.checked);
  const checked = marketItems.filter(i => i.checked);
  const total = marketItems.length;
  const doneCount = checked.length;
  const progress = total > 0 ? doneCount / total : 0;

  const uncheckedSections = useMemo(() => groupByCategory(unchecked), [unchecked]);

  const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);

  if (!supermarket || !list) {
    return <div className="p-8 text-center" style={{ color: '#a0937e' }}>加载中…</div>;
  }

  const onToggle = async (item: Item) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(10);
      await updateItem(item.id, {
        checked: !item.checked,
        checked_at: !item.checked ? new Date().toISOString() : null,
      });
    } catch { /* realtime will revert */ }
  };

  const handleEnd = () => {
    if (unchecked.length > 0) {
      setShowEndModal(true);
    } else {
      setShowEndModal(true);
    }
  };

  return (
    <div className="min-h-screen pb-8" style={{ background: '#faf6f0' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 pt-5 pb-3"
        style={{ background: 'rgba(250,246,240,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
          <span className="text-lg font-bold" style={{ color: '#5a4e3c' }}>{supermarket.name}</span>
          <button onClick={handleEnd} className="text-sm font-medium" style={{ color: '#7ca982' }}>结束</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#ede7dd' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: '#7ca982',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#7ca982' }}>{doneCount}/{total}</span>
        </div>
      </div>

      {/* Unchecked items by category — icon grid */}
      <div className="px-3 pt-3">
        {uncheckedSections.map(section => (
          <div key={section.category} className="mb-4">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <span className="text-xs font-semibold" style={{ color: CATEGORY_COLORS[section.category] || '#999' }}>
                {section.emoji} {section.category}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {section.items.map(item => (
                <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Uncategorized "顺便看看" */}
      {uncategorizedItems.length > 0 && (
        <div className="px-3 mt-2 mb-4">
          <button
            onClick={() => setUncategorizedCollapsed(c => !c)}
            className="flex items-center gap-1.5 mb-2 px-1"
          >
            <span className="text-xs" style={{ color: '#bbb' }}>{uncategorizedCollapsed ? '▸' : '▾'}</span>
            <span className="text-xs font-medium" style={{ color: '#bbb' }}>顺便看看 · 未分类</span>
            <span className="text-xs px-1.5 rounded-md" style={{ background: '#f0ebe3', color: '#ccc' }}>
              {uncategorizedItems.length}
            </span>
          </button>
          {!uncategorizedCollapsed && (
            <div className="grid grid-cols-3 gap-2.5">
              {uncategorizedItems.map(item => (
                <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} dimmed />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checked items (sunk to bottom) */}
      {checked.length > 0 && (
        <div className="px-3 mt-2">
          <div className="text-xs font-medium mb-2 px-1" style={{ color: '#bbb' }}>
            ✓ 已买 · {checked.length}件
          </div>
          <div className="grid grid-cols-3 gap-2.5 opacity-40">
            {checked.map(item => (
              <ItemCard key={item.id} item={item} customIconMap={customIconMap} onToggle={onToggle} checked />
            ))}
          </div>
        </div>
      )}

      {/* End shopping modal */}
      <ShoppingEndModal
        open={showEndModal}
        supermarketName={supermarket.name}
        totalCount={total}
        boughtCount={doneCount}
        missedCount={unchecked.length}
        listId={list.id}
        supermarketId={supermarket.id}
        items={marketItems}
        onClose={() => setShowEndModal(false)}
        onDone={() => nav(-1)}
      />
    </div>
  );
}

/* ---------- ItemCard sub-component ---------- */

function ItemCard({
  item, customIconMap, onToggle, checked, dimmed
}: {
  item: Item;
  customIconMap?: Map<string, string>;
  onToggle: (item: Item) => void;
  checked?: boolean;
  dimmed?: boolean;
}) {
  const iconUrl = resolveIconUrl(item.name, customIconMap);
  const [iconErr, setIconErr] = useState(false);
  const hasIcon = iconUrl && !iconErr;

  return (
    <button
      onClick={() => onToggle(item)}
      className="relative rounded-2xl p-2 text-center active:scale-95 transition-transform"
      style={{
        background: dimmed ? 'rgba(255,252,247,0.4)' : 'rgba(255,252,247,0.7)',
        border: dimmed ? '1px dashed rgba(215,205,188,0.4)' : '1px solid rgba(215,205,188,0.3)',
        boxShadow: dimmed ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Icon */}
      <div className="w-[72px] h-[72px] mx-auto mb-1.5 rounded-xl overflow-hidden relative">
        {hasIcon ? (
          <img
            src={iconUrl}
            alt=""
            className="w-full h-full object-contain p-1"
            style={{ mixBlendMode: 'multiply' }}
            onError={() => setIconErr(true)}
          />
        ) : (
          <WatercolorFallback name={item.name} category={item.category} size={72} />
        )}
        {checked && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,169,130,0.35)' }}>
            <span className="text-2xl text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>✓</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div
        className={`text-xs font-medium truncate ${checked ? 'line-through' : ''}`}
        style={{ color: checked ? '#bbb' : dimmed ? '#999' : '#5a4e3c' }}
      >
        {item.name}
      </div>

      {/* Note */}
      {item.note && !checked && (
        <div className="text-[10px] truncate mt-0.5" style={{ color: '#bbb' }}>{item.note}</div>
      )}

      {/* Quantity badge */}
      {item.quantity && !checked && (
        <div
          className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg text-white"
          style={{ background: '#c97b63' }}
        >
          ×{item.quantity}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Run dev server and verify the grid layout**

```bash
npm run dev
```

Verify:
1. Click "去购物" on a supermarket card
2. See top bar with supermarket name, progress bar (X/Y), back and end buttons
3. Items displayed as large icon grid (3 columns) grouped by category
4. Uncategorized items appear in collapsible "顺便看看" section
5. Checking an item moves it to the dimmed "已买" section at bottom
6. Progress bar updates when items are checked

- [ ] **Step 3: Commit**

```bash
git add src/routes/ShoppingMode.tsx
git commit -m "feat: implement shopping mode with icon grid layout and progress bar"
```

---

## Task 4: Shopping Mode — End Shopping Modal

**Files:**
- Create: `src/components/ShoppingEndModal.tsx`

- [ ] **Step 1: Create ShoppingEndModal component**

```typescript
// src/components/ShoppingEndModal.tsx
import { useState } from 'react';
import { savePurchaseHistory } from '@/lib/purchase-history';
import type { Item } from '@/types/item';
import type { HistoryItemSnapshot } from '@/types/purchase-history';

interface Props {
  open: boolean;
  supermarketName: string;
  totalCount: number;
  boughtCount: number;
  missedCount: number;
  listId: string;
  supermarketId: string;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}

const CELEBRATIONS = [
  { emoji: '🎉', text: '辛苦啦，今天的菜齐了！' },
  { emoji: '🌟', text: '太棒了，全部搞定！' },
  { emoji: '🛍️', text: '完美采购，一样不少！' },
  { emoji: '✨', text: '效率满分，回家做饭咯！' },
];

export function ShoppingEndModal({
  open, supermarketName, totalCount, boughtCount, missedCount,
  listId, supermarketId, items, onClose, onDone,
}: Props) {
  const [saving, setSaving] = useState(false);
  const allDone = missedCount === 0;
  const celebration = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];

  if (!open) return null;

  const saveAndClose = async (clearMissed: boolean) => {
    setSaving(true);
    try {
      const snapshot: HistoryItemSnapshot[] = items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        note: i.note,
        category: i.category,
        category_emoji: i.category_emoji,
        checked: i.checked,
      }));
      await savePurchaseHistory(listId, supermarketId, supermarketName, snapshot);
      // clearMissed is handled by the caller if needed — for now we just navigate back.
      // The unchecked items stay in the list (user chose "保留下次买") or the caller clears them.
    } catch {
      alert('保存失败，请重试');
      setSaving(false);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div
        className="mx-6 w-full max-w-sm rounded-3xl p-7 text-center"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        {allDone ? (
          <>
            <div className="text-5xl mb-3">{celebration.emoji}</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物完成</h3>
            <p className="text-sm mb-6" style={{ color: '#a0937e' }}>
              {celebration.text}
            </p>
            <button
              onClick={() => saveAndClose(false)}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#7ca982' }}
            >
              {saving ? '保存中…' : '返回清单'}
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🛍️</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#5a4e3c' }}>购物结束</h3>
            <p className="text-sm mb-6" style={{ color: '#a0937e' }}>
              还有 {missedCount} 件没买到
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => saveAndClose(false)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: '#7ca982' }}
              >
                {saving ? '保存中…' : '保留下次买'}
              </button>
              <button
                onClick={() => saveAndClose(true)}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-medium text-sm"
                style={{ background: '#f5f0ea', color: '#5a4e3c' }}
              >
                全部清除
              </button>
            </div>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-4 text-xs"
          style={{ color: '#ccc' }}
        >
          继续购物
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify end shopping flow**

```bash
npm run dev
```

Verify:
1. Enter shopping mode, check some items
2. Click "结束" — shows modal with "还有 X 件没买到"
3. Click "保留下次买" — saves history, returns to list, unchecked items remain
4. Enter shopping mode again, check ALL items — clicking "结束" shows random celebration
5. "继续购物" closes modal without saving

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ShoppingEndModal.tsx
git commit -m "feat: add end shopping modal with history save and celebrations"
```

---

## Task 5: Warm Copy

**Files:**
- Create: `src/utils/warm-copy.ts`
- Create: `tests/utils/warm-copy.test.ts`
- Modify: `src/routes/List.tsx`
- Modify: `src/components/AddSheet.tsx`

- [ ] **Step 1: Write test for warm copy**

```typescript
// tests/utils/warm-copy.test.ts
import { describe, it, expect } from 'vitest';
import { getProgressText, getEmptyListText, getAddSheetTitle } from '@/utils/warm-copy';

describe('warm-copy', () => {
  it('getProgressText shows remaining', () => {
    expect(getProgressText(3, 8)).toBe('快买完啦，还差 3 样~');
  });

  it('getProgressText shows done when 0 remain', () => {
    expect(getProgressText(0, 5)).toBe('全部买完啦！');
  });

  it('getEmptyListText returns warm message', () => {
    const text = getEmptyListText();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  it('getAddSheetTitle returns warm greeting', () => {
    expect(getAddSheetTitle()).toBe('今天想吃什么？');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/utils/warm-copy.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement warm copy**

```typescript
// src/utils/warm-copy.ts
export function getProgressText(remaining: number, total: number): string {
  if (remaining === 0) return '全部买完啦！';
  if (remaining <= 2) return `快买完啦，还差 ${remaining} 样~`;
  return `快买完啦，还差 ${remaining} 样~`;
}

export function getEmptyListText(): string {
  return '还没想好买什么，慢慢来~';
}

export function getEmptyListSubtext(): string {
  return '点底部 + 开始添加';
}

export function getAddSheetTitle(): string {
  return '今天想吃什么？';
}

export function getFinishShoppingText(checkedCount: number): string {
  return `🛍️ 买完了，清掉 ${checkedCount} 样`;
}

export function getHeaderSubtext(uncheckedCount: number): string {
  if (uncheckedCount === 0) return '清单空空的~';
  return `共享 · ${uncheckedCount}样待买`;
}

export function getBatchAddEncouragement(): string {
  const messages = ['哇，今天大采购！', '准备大显身手！', '好丰盛的清单~'];
  return messages[Math.floor(Math.random() * messages.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/utils/warm-copy.test.ts
```
Expected: PASS

- [ ] **Step 5: Update List.tsx with warm copy**

In `src/routes/List.tsx`, import warm copy functions:
```typescript
import { getEmptyListText, getEmptyListSubtext, getHeaderSubtext, getFinishShoppingText } from '@/utils/warm-copy';
```

Replace the header subtitle:
```tsx
// OLD:
<div className="text-xs" style={{ color: '#a0937e' }}>
  共享 · {uncheckedCount}项待买
</div>
// NEW:
<div className="text-xs" style={{ color: '#a0937e' }}>
  {getHeaderSubtext(uncheckedCount)}
</div>
```

Replace empty state:
```tsx
// OLD:
<div className="text-base" style={{ color: '#a0937e' }}>清单是空的</div>
<div className="text-xs mt-1" style={{ color: '#c4b49a' }}>点底部 + 添加第一项</div>
// NEW:
<div className="text-base" style={{ color: '#a0937e' }}>{getEmptyListText()}</div>
<div className="text-xs mt-1" style={{ color: '#c4b49a' }}>{getEmptyListSubtext()}</div>
```

Replace finish button text:
```tsx
// OLD:
🛍️ 完成采购，清掉 {checkedCount} 项
// NEW:
{getFinishShoppingText(checkedCount)}
```

- [ ] **Step 6: Update AddSheet.tsx title**

In `src/components/AddSheet.tsx`, import:
```typescript
import { getAddSheetTitle } from '@/utils/warm-copy';
```

Find the sheet title (look for text like "添加" or header area) and replace with `{getAddSheetTitle()}`.

- [ ] **Step 7: Run dev server, verify warm copy appears**

```bash
npm run dev
```

Verify:
1. Header shows "共享 · X样待买" (or "清单空空的~" if empty)
2. Empty list shows "还没想好买什么，慢慢来~"
3. Add sheet title shows "今天想吃什么？"
4. Finish button shows "🛍️ 买完了，清掉 X 样"

- [ ] **Step 8: Commit**

```bash
git add src/utils/warm-copy.ts tests/utils/warm-copy.test.ts src/routes/List.tsx src/components/AddSheet.tsx
git commit -m "feat: replace functional text with warm conversational copy"
```

---

## Task 6: Micro-animations

**Files:**
- Modify: `src/index.css`
- Modify: `src/routes/ShoppingMode.tsx` (ItemCard touch feedback)

- [ ] **Step 1: Add new animation keyframes to index.css**

Append to `src/index.css`:

```css
@keyframes leafFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  40% { transform: translateY(20px) rotate(-5deg); opacity: 0.8; }
  70% { transform: translateY(50px) rotate(3deg); opacity: 0.5; }
  100% { transform: translateY(80px) rotate(-2deg); opacity: 0; }
}

@keyframes inkSpread {
  0% { transform: scale(0.3); opacity: 0; filter: blur(8px); }
  50% { transform: scale(1.05); opacity: 0.8; filter: blur(2px); }
  100% { transform: scale(1); opacity: 1; filter: blur(0); }
}

@keyframes gentlePulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

@keyframes celebrationFloat {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.animate-leaf-fall {
  animation: leafFall 0.5s ease-out forwards;
}

.animate-ink-spread {
  animation: inkSpread 0.4s ease-out;
}

.animate-gentle-pulse {
  animation: gentlePulse 2s ease-in-out infinite;
}

.animate-celebration {
  animation: celebrationFloat 0.6s ease-out;
}
```

- [ ] **Step 2: Add page transition styles**

Append to `src/index.css`:

```css
.page-enter {
  animation: pageSlideIn 0.3s ease-out;
}

@keyframes pageSlideIn {
  0% { transform: translateX(30px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
```

- [ ] **Step 3: Apply page-enter to ShoppingMode**

In `src/routes/ShoppingMode.tsx`, add `page-enter` class to the root div:

```tsx
<div className="min-h-screen pb-8 page-enter" style={{ background: '#faf6f0' }}>
```

- [ ] **Step 4: Add ink-spread animation to ItemCard on check**

In `src/routes/ShoppingMode.tsx`, in the `ItemCard` component, track a local animation state:

```typescript
const [justChecked, setJustChecked] = useState(false);
```

Update the onToggle handler:
```typescript
const handleToggle = () => {
  if (!item.checked) setJustChecked(true);
  onToggle(item);
};
```

Add the check overlay animation:
```tsx
{(checked || justChecked) && (
  <div
    className={`absolute inset-0 rounded-xl flex items-center justify-center ${justChecked ? 'animate-ink-spread' : ''}`}
    style={{ background: 'rgba(124,169,130,0.35)' }}
    onAnimationEnd={() => setJustChecked(false)}
  >
    <span className="text-2xl text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>✓</span>
  </div>
)}
```

- [ ] **Step 5: Add celebration animation to ShoppingEndModal**

In `src/components/ShoppingEndModal.tsx`, add `animate-celebration` to the emoji div:

```tsx
<div className="text-5xl mb-3 animate-celebration">{celebration.emoji}</div>
```

- [ ] **Step 6: Run dev server, verify animations**

```bash
npm run dev
```

Verify:
1. Shopping mode slides in from right when opened
2. Checking an item shows ink-spread green overlay
3. Celebration emoji floats up when all items bought
4. Progress bar transitions smoothly

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/routes/ShoppingMode.tsx src/components/ShoppingEndModal.tsx
git commit -m "feat: add warm micro-animations (leaf-fall, ink-spread, page transitions)"
```

---

## Task 7: Purchase History UI

**Files:**
- Create: `src/routes/PurchaseHistory.tsx`
- Create: `src/routes/PurchaseHistoryDetail.tsx`
- Modify: `src/App.tsx` (add routes)
- Modify: `src/components/MoreMenu.tsx` (add entry)

- [ ] **Step 1: Create PurchaseHistory list page**

```typescript
// src/routes/PurchaseHistory.tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';

export default function PurchaseHistory() {
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const { history, loading } = usePurchaseHistory(list?.id ?? null);

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
        <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
        <span className="flex-1 text-center text-base font-semibold" style={{ color: '#5a4e3c' }}>购物历史</span>
        <span className="w-10" />
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
          <div className="space-y-2">
            {history.map(h => (
              <button
                key={h.id}
                onClick={() => nav(`/history/${h.id}`)}
                className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(255,252,247,0.6)',
                  border: '1px solid rgba(215,205,188,0.35)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color: '#5a4e3c' }}>
                    {h.supermarket_name}
                  </span>
                  <span className="text-xs" style={{ color: '#c4b49a' }}>
                    {new Date(h.completed_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-xs" style={{ color: '#a0937e' }}>
                  共 {h.total_count} 样 · 买了 {h.bought_count} 样
                  {h.total_count - h.bought_count > 0 && (
                    <span> · 漏了 {h.total_count - h.bought_count} 样</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create PurchaseHistoryDetail page**

```typescript
// src/routes/PurchaseHistoryDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { fetchPurchaseHistoryById } from '@/lib/purchase-history';
import { addItem } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import type { PurchaseHistory } from '@/types/purchase-history';
import type { HistoryItemSnapshot } from '@/types/purchase-history';

export default function PurchaseHistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid, null);
  const [record, setRecord] = useState<PurchaseHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    fetchPurchaseHistoryById(id).then(r => { setRecord(r); setLoading(false); });
  }, [id]);

  if (loading || !record) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf6f0', color: '#a0937e' }}>加载中…</div>;
  }

  const items = record.items_snapshot as HistoryItemSnapshot[];
  const allSelected = selected.size === items.length;

  const toggleItem = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((_, i) => i)));
  };

  const reAdd = async () => {
    if (!list || !uid || selected.size === 0) return;
    setAdding(true);
    try {
      for (const idx of selected) {
        const item = items[idx];
        await addItem(list.id, uid, {
          name: item.name,
          note: item.note,
          quantity: item.quantity,
          category: item.category,
          category_emoji: item.category_emoji,
          supermarket: record.supermarket_id,
        });
        recordItemUsage(uid, {
          name: item.name,
          note: item.note,
          supermarket: record.supermarket_id,
          category_emoji: item.category_emoji,
        });
      }
      alert(`已添加 ${selected.size} 样到清单`);
      nav('/list');
    } catch {
      alert('添加失败');
    } finally {
      setAdding(false);
    }
  };

  const dateStr = new Date(record.completed_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen pb-24 page-enter" style={{ background: '#faf6f0' }}>
      <header
        className="px-4 py-3 flex items-center sticky top-0 z-10"
        style={{ background: 'rgba(250,246,240,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(215,205,188,0.3)' }}
      >
        <button onClick={() => nav(-1)} className="text-sm" style={{ color: '#a0937e' }}>← 返回</button>
        <div className="flex-1 text-center">
          <div className="text-base font-semibold" style={{ color: '#5a4e3c' }}>{record.supermarket_name}</div>
          <div className="text-xs" style={{ color: '#a0937e' }}>{dateStr}</div>
        </div>
        <button onClick={selectAll} className="text-xs" style={{ color: '#7ca982' }}>
          {allSelected ? '取消全选' : '全选'}
        </button>
      </header>

      <main className="p-4 space-y-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => toggleItem(i)}
            className="w-full flex items-center gap-3 rounded-xl p-3 active:scale-[0.98] transition-transform"
            style={{
              background: selected.has(i) ? 'rgba(124,169,130,0.08)' : 'rgba(255,252,247,0.5)',
              border: selected.has(i) ? '1px solid rgba(124,169,130,0.3)' : '1px solid rgba(215,205,188,0.3)',
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{
              background: selected.has(i) ? '#7ca982' : 'transparent',
              border: selected.has(i) ? 'none' : '2px solid #d5cbbe',
            }}>
              {selected.has(i) && <span className="text-white text-xs">✓</span>}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm" style={{ color: item.checked ? '#5a4e3c' : '#c4b49a' }}>
                {item.category_emoji} {item.name}
                {item.quantity && <span className="text-xs ml-1" style={{ color: '#c97b63' }}>×{item.quantity}</span>}
              </div>
              {item.note && <div className="text-xs mt-0.5" style={{ color: '#a0937e' }}>{item.note}</div>}
            </div>
            {!item.checked && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#fff3e0', color: '#c97b63' }}>没买到</span>
            )}
          </button>
        ))}
      </main>

      {selected.size > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 mx-auto max-w-mobile px-4 py-3" style={{ background: 'linear-gradient(to top, #f3ede4 60%, transparent)' }}>
          <button
            onClick={reAdd}
            disabled={adding}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
            style={{ background: '#7ca982' }}
          >
            {adding ? '添加中…' : `再买一次 · ${selected.size} 样`}
          </button>
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add routes to App.tsx**

In `src/App.tsx`, add imports:
```typescript
import PurchaseHistory from '@/routes/PurchaseHistory';
import PurchaseHistoryDetail from '@/routes/PurchaseHistoryDetail';
```

Add routes:
```tsx
<Route path="/history" element={<PurchaseHistory />} />
<Route path="/history/:id" element={<PurchaseHistoryDetail />} />
```

- [ ] **Step 4: Add "购物历史" to MoreMenu**

In `src/components/MoreMenu.tsx`, add a new prop `onHistory` and a new menu item.

Add to Props interface:
```typescript
onHistory: () => void;
```

Add a menu button before the existing items:
```tsx
<button onClick={() => { onClose(); onHistory(); }} className="...">
  📋 购物历史
</button>
```

In `src/routes/List.tsx`, pass the new prop:
```tsx
<MoreMenu
  open={showMore}
  onClose={() => setShowMore(false)}
  onCopyShareText={onCopyShareText}
  onManageMarkets={() => nav('/manage-markets')}
  onSettings={() => nav('/settings')}
  onHistory={() => nav('/history')}
/>
```

- [ ] **Step 5: Run dev server and verify full history flow**

```bash
npm run dev
```

Verify:
1. Complete a shopping session via Shopping Mode → "结束" → "保留下次买"
2. Open MoreMenu → "购物历史" → see the record
3. Click into record → see all items with bought/missed status
4. Select items → click "再买一次" → items added back to list

- [ ] **Step 6: Commit**

```bash
git add src/routes/PurchaseHistory.tsx src/routes/PurchaseHistoryDetail.tsx src/App.tsx src/components/MoreMenu.tsx src/routes/List.tsx
git commit -m "feat: add purchase history list and detail pages with re-add"
```

---

## Task 8: Frequently Bought

**Files:**
- Create: `src/utils/frequently-bought.ts`
- Create: `tests/utils/frequently-bought.test.ts`
- Modify: `src/components/AddSheet.tsx`

- [ ] **Step 1: Write test for frequently-bought calculation**

```typescript
// tests/utils/frequently-bought.test.ts
import { describe, it, expect } from 'vitest';
import { calculateFrequentlyBought } from '@/utils/frequently-bought';
import type { PurchaseHistory } from '@/types/purchase-history';

const makeHistory = (items: { name: string; checked: boolean }[], date: string): PurchaseHistory => ({
  id: crypto.randomUUID(),
  list_id: 'list1',
  supermarket_id: 'tnt',
  supermarket_name: 'T&T',
  items_snapshot: items.map(i => ({
    name: i.name, quantity: '', note: '', category: '其他', category_emoji: '📦', checked: i.checked,
  })),
  total_count: items.length,
  bought_count: items.filter(i => i.checked).length,
  completed_at: date,
});

describe('calculateFrequentlyBought', () => {
  it('returns items that appear 3+ times', () => {
    const history = [
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-01'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '面包', checked: true }], '2026-05-08'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-15'),
      makeHistory([{ name: '牛奶', checked: true }, { name: '鸡蛋', checked: true }], '2026-05-22'),
    ];
    const result = calculateFrequentlyBought(history, 8);
    expect(result[0].name).toBe('牛奶');
    expect(result[0].count).toBe(4);
    expect(result.find(r => r.name === '鸡蛋')?.count).toBe(3);
    expect(result.find(r => r.name === '面包')).toBeUndefined();
  });

  it('only counts checked (bought) items', () => {
    const history = [
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-01'),
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-08'),
      makeHistory([{ name: '豆腐', checked: false }], '2026-05-15'),
    ];
    const result = calculateFrequentlyBought(history, 8);
    expect(result.find(r => r.name === '豆腐')).toBeUndefined();
  });

  it('respects limit', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ name: `item${i}`, checked: true }));
    const history = [
      makeHistory(items, '2026-05-01'),
      makeHistory(items, '2026-05-08'),
      makeHistory(items, '2026-05-15'),
    ];
    const result = calculateFrequentlyBought(history, 5);
    expect(result.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/utils/frequently-bought.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement frequently-bought calculation**

```typescript
// src/utils/frequently-bought.ts
import type { PurchaseHistory } from '@/types/purchase-history';

export interface FrequentlyBoughtItem {
  name: string;
  category: string;
  category_emoji: string;
  count: number;
}

export function calculateFrequentlyBought(
  history: PurchaseHistory[],
  limit: number
): FrequentlyBoughtItem[] {
  const counts = new Map<string, { category: string; emoji: string; count: number }>();

  for (const record of history) {
    const seen = new Set<string>();
    for (const item of record.items_snapshot) {
      if (!item.checked) continue;
      if (seen.has(item.name)) continue;
      seen.add(item.name);

      const existing = counts.get(item.name);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(item.name, { category: item.category, emoji: item.category_emoji, count: 1 });
      }
    }
  }

  const MIN_COUNT = 3;
  return Array.from(counts.entries())
    .filter(([, v]) => v.count >= MIN_COUNT)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, v]) => ({
      name,
      category: v.category,
      category_emoji: v.emoji,
      count: v.count,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/utils/frequently-bought.test.ts
```
Expected: PASS

- [ ] **Step 5: Integrate into AddSheet**

In `src/components/AddSheet.tsx`:

1. Import:
```typescript
import { usePurchaseHistory } from '@/hooks/usePurchaseHistory';
import { calculateFrequentlyBought } from '@/utils/frequently-bought';
```

2. Inside the component, after the existing `frequent` state, add:
```typescript
const { history } = usePurchaseHistory(listId);
const frequentlyBought = useMemo(
  () => calculateFrequentlyBought(history, 8),
  [history]
);
```

3. In the JSX, before the existing "frequent items" section, add a "常买" section:
```tsx
{frequentlyBought.length > 0 && (
  <div className="mb-3">
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-xs font-medium" style={{ color: '#a0937e' }}>♡ 常买</span>
      <button
        onClick={async () => {
          for (const item of frequentlyBought) {
            if (!addedItems.has(item.name)) {
              await onAdd({ name: item.name, category: item.category, category_emoji: item.category_emoji });
            }
          }
        }}
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(124,169,130,0.1)', color: '#7ca982' }}
      >
        全部加上
      </button>
    </div>
    <div className="grid grid-cols-4 gap-2">
      {frequentlyBought.map(item => (
        <IconButton
          key={`freq-${item.name}`}
          name={item.name}
          /* render using existing IconButton logic from AddSheet */
        />
      ))}
    </div>
  </div>
)}
```

Note: The exact integration depends on the `IconButton` sub-component structure already in AddSheet. Follow the same pattern used for the existing frequent items grid — the sub-component, props, and click handler should match.

- [ ] **Step 6: Run dev server and verify**

```bash
npm run dev
```

Verify (requires at least 3 purchase history records with overlapping items):
1. Open AddSheet → see "♡ 常买" section at top (if qualifying items exist)
2. "全部加上" button adds all frequently bought items at once
3. Individual items can be tapped to add

- [ ] **Step 7: Commit**

```bash
git add src/utils/frequently-bought.ts tests/utils/frequently-bought.test.ts src/components/AddSheet.tsx
git commit -m "feat: add frequently-bought section in AddSheet based on purchase history"
```

---

## Task 9: Brand Icon Audit

**Files:**
- No code changes — this is an audit task

- [ ] **Step 1: Scan all icon files for brand logos**

Check the `/public/icons/` directory for any icon files that depict specific brand products (logos, brand names, distinctive packaging).

```bash
ls public/icons/
```

- [ ] **Step 2: Cross-reference with icon-registry.ts**

Read `src/utils/icon-registry.ts` and identify which `ICON_ITEMS` entries map to potentially branded icons. Look for items that reference specific product brands rather than generic food items.

- [ ] **Step 3: Create replacement list with Gemini prompts**

For each branded icon, prepare a Gemini prompt following the existing style in `icon-prompts.md`. The prompt pattern is:

```
A delicate watercolor illustration of [GENERIC ITEM DESCRIPTION] on a pure white background.
Soft, translucent layers of color with visible brushstrokes.
Gentle shadows beneath. Japanese-inspired minimalist style.
No text, no labels, no brand markings. Clean, centered composition. 512x512.
```

Save the audit results and prompts to `docs/brand-icon-audit.md` for the user to process.

- [ ] **Step 4: Commit audit document**

```bash
git add docs/brand-icon-audit.md
git commit -m "docs: audit branded icons and prepare replacement prompts"
```

---

## Task 10: Integration Test & Polish

**Files:**
- Modify: various files for minor fixes

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Fix any type errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Fix any failing tests.

- [ ] **Step 3: Manual end-to-end verification**

Open http://localhost:5173 and verify the complete flow:

1. **Main list** → warm copy visible, empty state shows warm message
2. **Add items** → "今天想吃什么？" title, frequently-bought section (if history exists)
3. **SupermarketCard** → "去购物" button visible on non-empty cards
4. **Shopping Mode** → large icon grid, progress bar, category sections, uncategorized "顺便看看"
5. **Check items** → ink-spread animation, haptic vibrate, item sinks to bottom
6. **End shopping (partial)** → "还有 X 件没买到" modal, "保留下次买" saves history
7. **End shopping (complete)** → random celebration message with animation
8. **Purchase History** → accessible from MoreMenu, shows past sessions
9. **History Detail** → select items, "再买一次" adds to current list
10. **Page transitions** → smooth slide-in animation on all new pages

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes and polish for App Store optimization phase 1"
```

---

## Summary

| Task | Feature | Estimated Effort |
|------|---------|-----------------|
| 1 | Purchase History Data Layer | 15 min |
| 2 | Shopping Mode Route & Entry | 15 min |
| 3 | Shopping Mode Grid & Progress | 30 min |
| 4 | End Shopping Modal | 20 min |
| 5 | Warm Copy | 15 min |
| 6 | Micro-animations | 20 min |
| 7 | Purchase History UI | 25 min |
| 8 | Frequently Bought | 20 min |
| 9 | Brand Icon Audit | 15 min |
| 10 | Integration & Polish | 15 min |
| **Total** | | **~3 hours** |
