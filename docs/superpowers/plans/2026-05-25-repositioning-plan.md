# MaiSha Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform MaiSha from a grocery-focused supermarket list into a general-purpose per-store shopping companion with journal-style UI, icon grid layout, and three-language support.

**Architecture:** Rename the Supermarket data model to Store (text-only, no emoji). Remove the 11-category grouping system — items display as flat icon grids per store. Add i18n via i18next with zh-CN/zh-TW/en. Redesign UI with journal-style theme (ZCOOL KuaiLe + Noto Sans SC, paper texture, layered card shadows). Split list view (browse) from shopping mode (execute). Database columns stay unchanged for backward compatibility.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase, Capacitor, i18next + react-i18next, Vitest

**Spec:** `docs/superpowers/specs/2026-05-25-repositioning-design.md`

---

## Task 1: Rename Supermarket Type to Store

**Files:**
- Modify: `src/types/supermarket.ts` → rename to `src/types/store.ts`
- Modify: `src/types/item.ts`
- Modify: `src/types/list.ts`

- [ ] **Step 1: Create `src/types/store.ts` with the new Store interface**

```typescript
// src/types/store.ts
export interface Store {
  id: string;
  name: string;
}
```

- [ ] **Step 2: Update `src/types/list.ts` to use Store**

```typescript
// src/types/list.ts
import type { Store } from './store';

export interface List {
  id: string;
  name: string;
  owner_uid: string;
  member_uids: string[];
  supermarkets: Store[];  // DB column name unchanged
  short_code: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Update `src/types/item.ts` — remove CategoryKey, keep supermarket field name**

```typescript
// src/types/item.ts
export interface Item {
  id: string;
  list_id: string;
  name: string;
  note: string;
  quantity: string;
  supermarket: string;      // DB column name unchanged
  category: string;         // keep for backward compat, stop writing new values
  category_emoji: string;   // keep for backward compat, stop writing new values
  checked: boolean;
  checked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type NewItemInput = Pick<Item, 'name'> &
  Partial<Pick<Item, 'note' | 'quantity' | 'supermarket'>>;
```

Note: `category` and `category_emoji` removed from `NewItemInput` — we stop writing them but keep reading for backward compat.

- [ ] **Step 4: Delete `src/types/supermarket.ts`**

Run: `rm src/types/supermarket.ts`

- [ ] **Step 5: Fix all imports project-wide**

Find and replace across all files:
- `import type { Supermarket } from '@/types/supermarket'` → `import type { Store } from '@/types/store'`
- `import type { Supermarket } from './supermarket'` → `import type { Store } from './store'`
- Type annotations `Supermarket` → `Store` in function signatures and generics
- Keep variable/prop/column names like `supermarket`, `supermarkets` unchanged (these map to DB columns)

Key files to update:
- `src/utils/constants.ts`
- `src/utils/group-items.ts`
- `src/lib/db.ts`
- `src/hooks/useList.ts`
- `src/routes/List.tsx`
- `src/routes/ShoppingMode.tsx`
- `src/routes/ManageMarkets.tsx`
- `src/routes/EditItem.tsx`
- `src/routes/Onboarding.tsx`
- `src/components/SupermarketCard.tsx`
- `src/components/AddSheet.tsx`
- `src/components/ShareSheet.tsx`
- `src/components/ShoppingEndModal.tsx`

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename Supermarket type to Store, remove CategoryKey from NewItemInput"
```

---

## Task 2: Update Constants and Remove Category System

**Files:**
- Modify: `src/utils/constants.ts`
- Delete: `src/utils/category-matcher.ts`
- Modify: `src/utils/group-items.ts`

- [ ] **Step 1: Write test for new groupItemsByStore function**

Create `src/utils/__tests__/group-items.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { groupItemsByStore } from '../group-items';
import type { Item } from '@/types/item';
import type { Store } from '@/types/store';

const stores: Store[] = [
  { id: 'costco', name: 'Costco' },
  { id: 'ikea', name: 'IKEA' },
  { id: 'none', name: '未指定店铺' },
];

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: '1',
    list_id: 'list-1',
    name: 'Test',
    note: '',
    quantity: '',
    supermarket: 'costco',
    category: '其他',
    category_emoji: '📦',
    checked: false,
    checked_at: null,
    created_by: 'uid-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('groupItemsByStore', () => {
  it('groups items by store', () => {
    const items = [
      makeItem({ id: '1', name: 'Milk', supermarket: 'costco' }),
      makeItem({ id: '2', name: 'Eggs', supermarket: 'costco' }),
      makeItem({ id: '3', name: 'Lamp', supermarket: 'ikea' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result).toHaveLength(2);
    expect(result[0].store.id).toBe('costco');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].store.id).toBe('ikea');
    expect(result[1].items).toHaveLength(1);
  });

  it('puts unknown store items into fallback', () => {
    const items = [
      makeItem({ id: '1', name: 'Mystery', supermarket: 'deleted-store' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result).toHaveLength(1);
    expect(result[0].store.id).toBe('none');
    expect(result[0].items).toHaveLength(1);
  });

  it('returns empty array when no items and includeEmpty is false', () => {
    expect(groupItemsByStore([], stores, false)).toEqual([]);
  });

  it('returns all stores when includeEmpty is true', () => {
    const result = groupItemsByStore([], stores, true);
    expect(result).toHaveLength(3);
    expect(result.every(g => g.items.length === 0)).toBe(true);
  });

  it('puts fallback store last', () => {
    const items = [
      makeItem({ id: '1', supermarket: 'none' }),
      makeItem({ id: '2', supermarket: 'costco' }),
    ];
    const result = groupItemsByStore(items, stores);
    expect(result[result.length - 1].store.id).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/group-items.test.ts`
Expected: FAIL — `groupItemsByStore` does not exist

- [ ] **Step 3: Update `src/utils/constants.ts`**

Replace entire file:

```typescript
import type { Store } from '@/types/store';

export const UNDELETABLE_STORE_ID = 'none';

export const DEFAULT_STORES: Store[] = [
  { id: 'none', name: '未指定店铺' },
];
```

- [ ] **Step 4: Rewrite `src/utils/group-items.ts` — flat grouping by store, no categories**

Replace entire file:

```typescript
import type { Item } from '@/types/item';
import type { Store } from '@/types/store';
import { UNDELETABLE_STORE_ID } from './constants';

export interface StoreGroup {
  store: Store;
  items: Item[];
  totalCount: number;
}

export function groupItemsByStore(
  items: Item[],
  stores: Store[],
  includeEmpty = false
): StoreGroup[] {
  if (!items.length && !includeEmpty) return [];

  // Fallback store always last
  const sorted = [
    ...stores.filter(s => s.id !== UNDELETABLE_STORE_ID),
    ...stores.filter(s => s.id === UNDELETABLE_STORE_ID),
  ];
  const validIds = new Set(sorted.map(s => s.id));
  const storeMap = new Map(sorted.map(s => [s.id, s]));

  const byStore = new Map<string, Item[]>();
  for (const item of items) {
    const sid = validIds.has(item.supermarket) ? item.supermarket : UNDELETABLE_STORE_ID;
    if (!byStore.has(sid)) byStore.set(sid, []);
    byStore.get(sid)!.push(item);
  }

  const out: StoreGroup[] = [];
  for (const s of sorted) {
    const bucket = byStore.get(s.id);
    if (!bucket?.length) {
      if (includeEmpty) {
        out.push({ store: storeMap.get(s.id)!, items: [], totalCount: 0 });
      }
      continue;
    }
    out.push({ store: storeMap.get(s.id)!, items: bucket, totalCount: bucket.length });
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/group-items.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 6: Delete `src/utils/category-matcher.ts`**

Run: `rm src/utils/category-matcher.ts`

- [ ] **Step 7: Remove all imports of category-matcher and CATEGORY_DEFS**

Search for and remove from all files:
- `import { matchCategory } from '@/utils/category-matcher'`
- `import { CATEGORY_DEFS, ... } from '@/utils/constants'`
- Any usage of `matchCategory()`, `CATEGORY_DEFS`, `CATEGORY_ORDER`, `CATEGORY_COLORS`
- References to `FALLBACK_CATEGORY`, `FALLBACK_CATEGORY_EMOJI`
- Update `UNDELETABLE_SUPERMARKET_ID` → `UNDELETABLE_STORE_ID` everywhere

Key files:
- `src/components/AddSheet.tsx` — remove category matching logic, CATEGORY_ORDER, CATEGORY_COLORS
- `src/routes/ShoppingMode.tsx` — remove CATEGORY_COLORS, groupByCategory helper
- `src/routes/List.tsx` — update groupItemsByMarketAndCategory → groupItemsByStore
- `src/lib/db.ts` — stop writing category/category_emoji in addItem

- [ ] **Step 8: Update `src/lib/db.ts` addItem — stop writing category fields**

Change the insert in `addItem` (line 61-72):

```typescript
export async function addItem(listId: string, createdBy: string, input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      list_id: listId,
      name: input.name,
      note: input.note ?? '',
      quantity: input.quantity ?? '',
      supermarket: input.supermarket ?? 'none',
      category: '其他',         // static default, field deprecated
      category_emoji: '📦',     // static default, field deprecated
      checked: false,
      checked_at: null,
      created_by: createdBy
    })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}
```

Also update `DEFAULT_SUPERMARKETS` → `DEFAULT_STORES` import in db.ts:

```typescript
import { DEFAULT_STORES } from '@/utils/constants';
```

And in `getOrCreateList`, change `supermarkets = DEFAULT_SUPERMARKETS` to `supermarkets = DEFAULT_STORES`.

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: remove category system, simplify to flat store grouping"
```

---

## Task 3: i18n Setup

**Files:**
- Create: `src/locales/zh-CN.json`
- Create: `src/locales/zh-TW.json`
- Create: `src/locales/en.json`
- Create: `src/i18n.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install i18next dependencies**

Run: `npm install i18next react-i18next i18next-browser-languagedetector`

- [ ] **Step 2: Create `src/locales/zh-CN.json`**

```json
{
  "app": {
    "title": "买啥"
  },
  "nav": {
    "list": "清单",
    "history": "历史"
  },
  "header": {
    "joinList": "一起买",
    "settings": "设置"
  },
  "list": {
    "items": "{{count}} 样",
    "goShopping": "去购物",
    "addItem": "+ 添加物品",
    "emptyTitle": "还没有东西要买",
    "emptySubtitle": "点下面的按钮开始添加吧"
  },
  "shopping": {
    "back": "返回",
    "progress": "已买 {{bought}} / {{total}} 样",
    "addMore": "+ 临时加一个",
    "finish": "结束购物"
  },
  "addSheet": {
    "title": "添加物品",
    "namePlaceholder": "要买什么？",
    "notePlaceholder": "备注（可选）",
    "quantityPlaceholder": "数量",
    "store": "店铺",
    "noStore": "未指定店铺",
    "add": "添加",
    "frequent": "常买"
  },
  "stores": {
    "manage": "管理店铺",
    "addNew": "添加新店铺",
    "namePlaceholder": "输入店铺名称",
    "unassigned": "未指定店铺",
    "save": "保存"
  },
  "settings": {
    "title": "设置",
    "language": "语言设置",
    "iconLibrary": "图标库",
    "importExport": "导入 / 导出",
    "personalPresets": "个人预设",
    "privacy": "隐私与条款",
    "contact": "联系我们"
  },
  "onboarding": {
    "welcome": "欢迎使用买啥",
    "addStores": "你常去哪些店？",
    "addStoresHint": "添加 1-2 个常去的店铺",
    "storePlaceholder": "输入店铺名称",
    "skip": "跳过",
    "currency": "选择货币",
    "done": "开始使用"
  },
  "share": {
    "title": "一起买",
    "description": "分享链接，邀请家人一起编辑清单",
    "copyLink": "复制链接",
    "copied": "已复制",
    "orCode": "或输入邀请码加入"
  },
  "common": {
    "cancel": "取消",
    "confirm": "确认",
    "delete": "删除",
    "edit": "编辑",
    "save": "保存",
    "loading": "加载中…"
  }
}
```

- [ ] **Step 3: Create `src/locales/en.json`**

```json
{
  "app": {
    "title": "MaiSha"
  },
  "nav": {
    "list": "List",
    "history": "History"
  },
  "header": {
    "joinList": "Invite",
    "settings": "Settings"
  },
  "list": {
    "items": "{{count}} items",
    "goShopping": "Go shopping",
    "addItem": "+ Add item",
    "emptyTitle": "Nothing to buy yet",
    "emptySubtitle": "Tap below to start adding items"
  },
  "shopping": {
    "back": "Back",
    "progress": "{{bought}} / {{total}} bought",
    "addMore": "+ Add one more",
    "finish": "Done shopping"
  },
  "addSheet": {
    "title": "Add item",
    "namePlaceholder": "What to buy?",
    "notePlaceholder": "Note (optional)",
    "quantityPlaceholder": "Qty",
    "store": "Store",
    "noStore": "No store",
    "add": "Add",
    "frequent": "Frequent"
  },
  "stores": {
    "manage": "Manage stores",
    "addNew": "Add new store",
    "namePlaceholder": "Store name",
    "unassigned": "No store",
    "save": "Save"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "iconLibrary": "Icon library",
    "importExport": "Import / Export",
    "personalPresets": "Presets",
    "privacy": "Privacy & Terms",
    "contact": "Contact us"
  },
  "onboarding": {
    "welcome": "Welcome to MaiSha",
    "addStores": "Where do you shop?",
    "addStoresHint": "Add 1-2 stores you visit often",
    "storePlaceholder": "Store name",
    "skip": "Skip",
    "currency": "Choose currency",
    "done": "Get started"
  },
  "share": {
    "title": "Invite",
    "description": "Share a link so others can edit this list with you",
    "copyLink": "Copy link",
    "copied": "Copied!",
    "orCode": "Or join with a code"
  },
  "common": {
    "cancel": "Cancel",
    "confirm": "Confirm",
    "delete": "Delete",
    "edit": "Edit",
    "save": "Save",
    "loading": "Loading…"
  }
}
```

- [ ] **Step 4: Create `src/locales/zh-TW.json`**

```json
{
  "app": {
    "title": "買咩"
  },
  "nav": {
    "list": "清單",
    "history": "記錄"
  },
  "header": {
    "joinList": "一齊買",
    "settings": "設定"
  },
  "list": {
    "items": "{{count}} 樣",
    "goShopping": "去買嘢",
    "addItem": "+ 添加物品",
    "emptyTitle": "仲未有嘢要買",
    "emptySubtitle": "撳下面個按鈕開始添加啦"
  },
  "shopping": {
    "back": "返回",
    "progress": "買咗 {{bought}} / {{total}} 樣",
    "addMore": "+ 臨時加一樣",
    "finish": "買完啦"
  },
  "addSheet": {
    "title": "添加物品",
    "namePlaceholder": "要買咩？",
    "notePlaceholder": "備註（可選）",
    "quantityPlaceholder": "數量",
    "store": "舖頭",
    "noStore": "未指定舖頭",
    "add": "添加",
    "frequent": "常買"
  },
  "stores": {
    "manage": "管理舖頭",
    "addNew": "添加新舖頭",
    "namePlaceholder": "輸入舖頭名",
    "unassigned": "未指定舖頭",
    "save": "儲存"
  },
  "settings": {
    "title": "設定",
    "language": "語言設定",
    "iconLibrary": "圖標庫",
    "importExport": "導入 / 導出",
    "personalPresets": "個人預設",
    "privacy": "私隱與條款",
    "contact": "聯絡我哋"
  },
  "onboarding": {
    "welcome": "歡迎使用買咩",
    "addStores": "你成日去邊度買嘢？",
    "addStoresHint": "添加 1-2 間常去嘅舖頭",
    "storePlaceholder": "輸入舖頭名",
    "skip": "跳過",
    "currency": "揀貨幣",
    "done": "開始用"
  },
  "share": {
    "title": "一齊買",
    "description": "分享連結，邀請屋企人一齊編輯清單",
    "copyLink": "複製連結",
    "copied": "已複製",
    "orCode": "或者輸入邀請碼加入"
  },
  "common": {
    "cancel": "取消",
    "confirm": "確認",
    "delete": "刪除",
    "edit": "編輯",
    "save": "儲存",
    "loading": "載入中…"
  }
}
```

- [ ] **Step 5: Create `src/i18n.ts` — i18next initialization**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      en: { translation: en },
    },
    fallbackLng: 'zh-CN',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'maisha:language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

- [ ] **Step 6: Import i18n in `src/main.tsx`**

Add at the top of `src/main.tsx` (before React imports):

```typescript
import './i18n';
```

- [ ] **Step 7: Verify app starts without errors**

Run: `npm run dev`
Open browser — app should load without i18n errors in console.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add i18n with zh-CN, zh-TW (Cantonese), and English locales"
```

---

## Task 4: Journal-Style Visual Theme

**Files:**
- Create: `src/styles/theme.css`
- Modify: `src/index.css` or main stylesheet
- Modify: `index.html` (Google Fonts link)

- [ ] **Step 1: Add Google Fonts to `index.html`**

Add in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Nunito:wght@400;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Create `src/styles/theme.css` with CSS variables**

```css
:root {
  /* Paper palette */
  --paper: #FBF6EF;
  --paper-dark: #F3EBDD;

  /* Ink palette */
  --ink: #4A3728;
  --ink-light: #8B7355;
  --ink-faint: #C4B49A;

  /* Accent colors */
  --accent: #D4836B;
  --accent-soft: #E8AE97;
  --green: #7BA37E;
  --green-soft: #B5D1B7;
  --blue: #7BA3B8;

  /* Typography */
  --font-title: 'ZCOOL KuaiLe', 'Nunito', sans-serif;
  --font-body: 'Noto Sans SC', 'Nunito', sans-serif;
  --font-en: 'Nunito', sans-serif;

  /* Shadows */
  --shadow-card:
    0 2px 4px rgba(74, 55, 40, 0.06),
    0 6px 16px rgba(74, 55, 40, 0.08),
    0 12px 32px rgba(74, 55, 40, 0.05);
  --shadow-icon: 0 2px 6px rgba(74, 55, 40, 0.06);

  /* Radii */
  --radius-card: 14px;
  --radius-icon: 14px;
  --radius-pill: 20px;
}

/* Base body styles */
body {
  font-family: var(--font-body);
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Import theme.css in `src/main.tsx`**

Add before other CSS imports:

```typescript
import './styles/theme.css';
```

- [ ] **Step 4: Verify fonts load and variables are applied**

Run: `npm run dev`
Open browser — text should render in Noto Sans SC, page background should be warm off-white (#FBF6EF).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add journal-style theme with fonts, colors, and CSS variables"
```

---

## Task 5: StoreCard Component (Replaces SupermarketCard)

**Files:**
- Create: `src/components/StoreCard.tsx`
- Create: `src/components/ItemGrid.tsx`

- [ ] **Step 1: Create `src/components/ItemGrid.tsx` — icon grid for list view**

```typescript
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { resolveIconUrl } from '@/utils/icon-registry';
import { WatercolorFallback } from './WatercolorFallback';
import type { Item } from '@/types/item';

interface Props {
  items: Item[];
  customIconMap?: Map<string, string>;
  onItemTap?: (item: Item) => void;
}

export function ItemGrid({ items, customIconMap, onItemTap }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px',
      marginBottom: '10px',
    }}>
      {items.map(item => {
        const iconUrl = customIconMap?.get(item.name) ?? resolveIconUrl(item.name);
        return (
          <div
            key={item.id}
            onClick={() => onItemTap?.(item)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-icon)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-icon)',
              background: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {iconUrl
                ? <img src={iconUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <WatercolorFallback name={item.name} size={52} />
              }
            </div>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink)',
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: 64,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.name}
            </span>
            {(item.note || item.quantity) && (
              <span style={{
                fontSize: 10,
                color: 'var(--ink-faint)',
                textAlign: 'center',
              }}>
                {item.quantity ? `x${item.quantity}` : item.note}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/StoreCard.tsx`**

```typescript
import { useNavigate } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ItemGrid } from './ItemGrid';
import type { StoreGroup } from '@/utils/group-items';
import type { Item } from '@/types/item';

interface Props {
  group: StoreGroup;
  customIconMap?: Map<string, string>;
  onItemTap?: (item: Item) => void;
  colorIndex?: number;
}

const BORDER_COLORS = ['var(--accent-soft)', 'var(--green-soft)', 'var(--blue)'];

export function StoreCard({ group, customIconMap, onItemTap, colorIndex = 0 }: Props) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: group.store.id });
  const borderColor = BORDER_COLORS[colorIndex % BORDER_COLORS.length];

  return (
    <div
      ref={setNodeRef}
      style={{
        margin: '12px 18px',
        padding: '16px 18px 12px',
        background: 'white',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        borderLeft: `4px solid ${borderColor}`,
        opacity: isOver ? 0.95 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Store header */}
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
        <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          {t('list.items', { count: group.totalCount })}
        </span>
      </div>

      {/* Item grid */}
      {group.items.length > 0 && (
        <ItemGrid
          items={group.items}
          customIconMap={customIconMap}
          onItemTap={onItemTap}
        />
      )}

      {/* Go shopping button */}
      {group.items.length > 0 && (
        <button
          onClick={() => nav(`/shopping/${group.store.id}`)}
          style={{
            display: 'inline-block',
            marginTop: 8,
            padding: '5px 16px',
            background: 'var(--paper)',
            border: '1.5px solid var(--ink-faint)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink-light)',
            cursor: 'pointer',
          }}
        >
          {t('list.goShopping')} →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add StoreCard and ItemGrid components for journal-style list view"
```

---

## Task 6: Redesign List Page

**Files:**
- Modify: `src/routes/List.tsx`

- [ ] **Step 1: Rewrite List.tsx with tabs, new header, StoreCard**

Replace the imports and component. Key changes:
- Import `StoreCard` instead of `SupermarketCard`
- Import `groupItemsByStore` instead of `groupItemsByMarketAndCategory`
- Import `useTranslation` from react-i18next
- Add "清单/历史" tab state
- Replace header with `买啥 / [一起买] [⚙]`
- Render `StoreCard` per group with icon grid
- Remove all checkbox/toggle logic from list view (no `onToggle` prop)
- History tab shows existing PurchaseHistory inline

Update the imports section:
```typescript
import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  DndContext, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { useItems } from '@/hooks/useItems';
import { useCustomIcons } from '@/hooks/useCustomIcons';
import { useUndoToast } from '@/hooks/useUndoToast';
import { useOffline } from '@/hooks/useOffline';
import { StoreCard } from '@/components/StoreCard';
import { AddSheet } from '@/components/AddSheet';
import { ItemMenu } from '@/components/ItemMenu';
import { SetIconSheet } from '@/components/SetIconSheet';
import { MoreMenu } from '@/components/MoreMenu';
import { ConfirmModal } from '@/components/ConfirmModal';
import { UndoToast } from '@/components/UndoToast';
import { ImportSheet } from '@/components/ImportSheet';
import { groupItemsByStore } from '@/utils/group-items';
import { addItem, updateItem, deleteItem, clearChecked } from '@/lib/db';
import { recordItemUsage } from '@/utils/frequent-items';
import type { Item, NewItemInput } from '@/types/item';
```

Add tab state and updated groups:
```typescript
const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
const { t } = useTranslation();

const groups = useMemo(
  () => (list ? groupItemsByStore(items, list.supermarkets, !!draggingItem) : []),
  [items, list, draggingItem]
);
```

Update the header JSX:
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
    <button onClick={() => setShowShare(true)} style={{
      fontFamily: 'var(--font-body)', fontSize: 15,
      color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
    }}>
      {t('header.joinList')}
    </button>
    <button onClick={() => nav('/settings')} style={{
      fontSize: 20, color: 'var(--ink-light)', background: 'none', border: 'none', cursor: 'pointer',
    }}>
      ⚙
    </button>
  </div>
</div>

{/* Divider */}
<div style={{
  margin: '0 24px', height: 2, opacity: 0.5,
  background: 'repeating-linear-gradient(90deg, var(--ink-faint) 0px, var(--ink-faint) 6px, transparent 6px, transparent 10px)',
}} />

{/* Tabs */}
<div style={{ display: 'flex', padding: '10px 24px 4px' }}>
  <button
    onClick={() => setActiveTab('list')}
    style={{
      fontFamily: 'var(--font-body)', fontSize: 15, cursor: 'pointer',
      padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
      fontWeight: activeTab === 'list' ? 700 : 500,
      color: activeTab === 'list' ? 'var(--ink)' : 'var(--ink-faint)',
      background: activeTab === 'list' ? 'rgba(232, 174, 151, 0.15)' : 'none',
    }}
  >
    {t('nav.list')}
  </button>
  <button
    onClick={() => setActiveTab('history')}
    style={{
      fontFamily: 'var(--font-body)', fontSize: 15, cursor: 'pointer',
      padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
      fontWeight: activeTab === 'history' ? 700 : 500,
      color: activeTab === 'history' ? 'var(--ink)' : 'var(--ink-faint)',
      background: activeTab === 'history' ? 'rgba(232, 174, 151, 0.15)' : 'none',
    }}
  >
    {t('nav.history')}
  </button>
</div>
```

Replace the SupermarketCard rendering with StoreCard:
```tsx
{activeTab === 'list' && (
  <>
    {groups.map((group, i) => (
      <StoreCard
        key={group.store.id}
        group={group}
        customIconMap={customIconMap}
        onItemTap={(item) => setMenuItem(item)}
        colorIndex={i}
      />
    ))}
    {/* Add item area */}
    <div
      onClick={() => setShowAdd(true)}
      style={{
        margin: '16px 18px',
        padding: '14px 18px',
        border: '2px dashed var(--ink-faint)',
        borderRadius: 'var(--radius-card)',
        textAlign: 'center',
        color: 'var(--ink-light)',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        opacity: 0.6,
      }}
    >
      {t('list.addItem')}
    </div>
  </>
)}

{activeTab === 'history' && (
  <PurchaseHistoryInline listId={list.id} />
)}
```

- [ ] **Step 2: Remove `onToggle` from StoreCard/ItemGrid — no checking in list view**

Ensure the list view has no checkbox or toggle behavior. Item taps only open the edit/menu modal.

- [ ] **Step 3: Verify the app renders correctly**

Run: `npm run dev`
Open browser — should see journal-styled header, tabs, store cards with icon grids.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: redesign List page with tabs, StoreCard, and journal-style header"
```

---

## Task 7: Redesign Shopping Mode

**Files:**
- Modify: `src/routes/ShoppingMode.tsx`

- [ ] **Step 1: Rewrite ShoppingMode with image+text layout and auto-sink**

Key changes:
- Remove category grouping — flat item list per store
- Add image/icon next to each item (same icons as list view)
- Tap item to mark as bought → fade + green badge
- Bought items auto-sort to bottom
- Progress bar with green gradient
- `useTranslation` for all copy

Core sorting logic:
```typescript
const sortedItems = useMemo(() => {
  const unchecked = marketItems.filter(i => !i.checked);
  const checked = marketItems.filter(i => i.checked);
  return [...unchecked, ...checked];
}, [marketItems]);
```

Shopping item row rendering:
```tsx
{sortedItems.map(item => {
  const iconUrl = customIconMap?.get(item.name) ?? resolveIconUrl(item.name);
  return (
    <div
      key={item.id}
      onClick={() => handleToggle(item)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 0',
        gap: 14,
        borderBottom: '1px dashed rgba(196, 180, 154, 0.25)',
        cursor: 'pointer',
        opacity: item.checked ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 12,
        overflow: 'hidden', flexShrink: 0,
        boxShadow: 'var(--shadow-icon)',
        background: 'var(--paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {iconUrl
          ? <img src={iconUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <WatercolorFallback name={item.name} size={46} />
        }
      </div>

      {/* Name + note */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 500,
          color: item.checked ? 'var(--ink-faint)' : 'var(--ink)',
        }}>
          {item.name}
        </span>
        {(item.note || item.quantity) && (
          <span style={{ fontSize: 13, color: 'var(--ink-light)' }}>
            {item.quantity ? `x${item.quantity}` : item.note}
          </span>
        )}
      </div>

      {/* Bought badge */}
      {item.checked && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--green-soft)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          ✓
        </div>
      )}
    </div>
  );
})}
```

- [ ] **Step 2: Update toggle handler to record checked_at timestamp**

```typescript
async function handleToggle(item: Item) {
  const newChecked = !item.checked;
  await updateItem(item.id, {
    checked: newChecked,
    checked_at: newChecked ? new Date().toISOString() : null,
  });
}
```

- [ ] **Step 3: Verify shopping mode renders correctly**

Run: `npm run dev`
Navigate to shopping mode for a store — should see image+text items, bought items sink to bottom.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: redesign ShoppingMode with image+text layout and auto-sink for bought items"
```

---

## Task 8: Rewrite Onboarding

**Files:**
- Modify: `src/routes/Onboarding.tsx`

- [ ] **Step 1: Rewrite onboarding with new flow: language → stores → currency**

Key changes:
- Remove household size step
- Remove supermarket presets with emojis
- Step 1: Language selection (zh-CN / zh-TW / en)
- Step 2: Add 1-2 store names (free text input + "skip" option)
- Step 3: Currency selection
- Use `useTranslation` for copy
- On finish, save stores as `Store[]` (text only, no emoji) to localStorage

New steps constant:
```typescript
const TOTAL_STEPS = 3;
```

Step 1 (Language):
```tsx
<div>
  <h2>{t('settings.language')}</h2>
  {[
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en', label: 'English' },
  ].map(lang => (
    <button
      key={lang.code}
      onClick={() => { i18n.changeLanguage(lang.code); setLanguage(lang.code); }}
      style={{
        /* active style if language === lang.code */
      }}
    >
      {lang.label}
    </button>
  ))}
</div>
```

Step 2 (Stores — free text):
```tsx
<div>
  <h2>{t('onboarding.addStores')}</h2>
  <p>{t('onboarding.addStoresHint')}</p>
  {addedStores.map((store, i) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span>{store.name}</span>
      <button onClick={() => removeStore(i)}>×</button>
    </div>
  ))}
  <input
    value={newStoreName}
    onChange={e => setNewStoreName(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && addStore()}
    placeholder={t('onboarding.storePlaceholder')}
  />
  <button onClick={addStore}>{t('common.confirm')}</button>
</div>
```

Store creation logic:
```typescript
const [addedStores, setAddedStores] = useState<Store[]>([]);
const [newStoreName, setNewStoreName] = useState('');

function addStore() {
  if (!newStoreName.trim()) return;
  const id = newStoreName.trim().toLowerCase().replace(/\s+/g, '-');
  setAddedStores(prev => [...prev, { id, name: newStoreName.trim() }]);
  setNewStoreName('');
}
```

Finish handler:
```typescript
function finish() {
  const stores: Store[] = [
    ...addedStores,
    { id: 'none', name: t('addSheet.noStore') },
  ];
  localStorage.setItem('maisha:onboard-supermarkets', JSON.stringify(stores));
  localStorage.setItem('maisha:language', language);
  nav('/list');
}
```

- [ ] **Step 2: Verify onboarding flow works end to end**

Run: `npm run dev`
Clear localStorage, navigate to `/onboarding` — should see 3 steps.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: rewrite onboarding with language, store names, and currency steps"
```

---

## Task 9: Rename ManageMarkets to ManageStores

**Files:**
- Rename: `src/routes/ManageMarkets.tsx` → `src/routes/ManageStores.tsx`
- Modify: `src/App.tsx` (route)

- [ ] **Step 1: Rename file and update component**

Rename file, then update inside:
- Component name: `ManageMarkets` → `ManageStores`
- Import `Store` instead of `Supermarket`
- Import `UNDELETABLE_STORE_ID` instead of `UNDELETABLE_SUPERMARKET_ID`
- Use `useTranslation` for all copy
- Remove emoji field from new store creation — only text name
- State type: `useState<Store[]>([])` instead of `useState<Supermarket[]>([])`

New store creation (remove emoji):
```typescript
const addMarket = () => {
  if (!newName.trim()) return;
  const id = crypto.randomUUID();
  setItems(prev => [
    ...prev.filter(s => s.id !== UNDELETABLE_STORE_ID),
    { id, name: newName.trim() },
    ...prev.filter(s => s.id === UNDELETABLE_STORE_ID),
  ]);
  setNewName('');
};
```

- [ ] **Step 2: Update route in `src/App.tsx`**

```typescript
<Route path="/manage-stores" element={<ManageStores />} />
```

Update lazy import if applicable. Also search for any `nav('/manage-markets')` calls and change to `nav('/manage-stores')`.

- [ ] **Step 3: Verify ManageStores page works**

Run: `npm run dev`, navigate to `/manage-stores`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename ManageMarkets to ManageStores, remove emoji from stores"
```

---

## Task 10: Settings Drawer

**Files:**
- Create: `src/components/SettingsDrawer.tsx`
- Modify: `src/routes/List.tsx` (add drawer trigger)

- [ ] **Step 1: Create `src/components/SettingsDrawer.tsx`**

```typescript
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();

  const items = [
    { label: t('settings.language'), action: () => nav('/settings/language') },
    { label: t('settings.iconLibrary'), action: () => nav('/icons') },
    { label: t('settings.importExport'), action: () => nav('/settings/import-export') },
    { label: t('settings.personalPresets'), action: () => nav('/manage-stores') },
    { label: t('settings.privacy'), action: () => nav('/privacy') },
    { label: t('settings.contact'), action: () => window.open('mailto:support@maisha.app') },
  ];

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
      </div>
    </>
  );
}
```

- [ ] **Step 2: Integrate SettingsDrawer in List.tsx**

Add state and import:
```typescript
import { SettingsDrawer } from '@/components/SettingsDrawer';

const [showSettings, setShowSettings] = useState(false);
```

Change ⚙ button to open drawer instead of navigating:
```tsx
<button onClick={() => setShowSettings(true)} style={{ /* ... */ }}>⚙</button>

{/* At the end of the component */}
<SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
```

- [ ] **Step 3: Verify drawer opens and closes**

Run: `npm run dev`, tap ⚙ — drawer should slide in from left.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add SettingsDrawer with left slide-in panel"
```

---

## Task 11: Update AddSheet for Store-Only Input

**Files:**
- Modify: `src/components/AddSheet.tsx`

- [ ] **Step 1: Remove all category-related logic from AddSheet**

Remove:
- `import { matchCategory }` line
- `CATEGORY_ORDER` constant
- `CATEGORY_COLORS` constant
- Any state/logic that auto-assigns category on input
- Category selector UI in the sheet
- Category chips/tags display

Keep:
- Store selector (rename label from "超市" to `t('addSheet.store')`)
- Name, note, quantity inputs
- Frequent items chips
- Icon picker / AI generation
- Use `useTranslation` for all copy

- [ ] **Step 2: Update the store selector to use Store type (no emoji)**

Replace any supermarket display that shows emoji + name with just name:

```tsx
{list.supermarkets.map(store => (
  <button
    key={store.id}
    onClick={() => setSelectedStore(store.id)}
    style={{
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      border: `1.5px solid ${selectedStore === store.id ? 'var(--accent)' : 'var(--ink-faint)'}`,
      background: selectedStore === store.id ? 'rgba(212, 131, 107, 0.1)' : 'none',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: selectedStore === store.id ? 'var(--accent)' : 'var(--ink-light)',
      cursor: 'pointer',
    }}
  >
    {store.name}
  </button>
))}
```

- [ ] **Step 3: Verify AddSheet works without categories**

Run: `npm run dev`, open add sheet — should show store selector without emojis, no category picker.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: update AddSheet to remove categories and use text-only store selector"
```

---

## Task 12: Cleanup Dead Code and Update Routes

**Files:**
- Delete: `src/components/SupermarketCard.tsx`
- Delete: `src/components/ItemRow.tsx` (if fully replaced by ItemGrid)
- Modify: `src/App.tsx`
- Modify: various files for leftover references

- [ ] **Step 1: Delete old components that are fully replaced**

```bash
rm src/components/SupermarketCard.tsx
```

If `ItemRow.tsx` is still used in ShoppingMode or EditItem, keep it. Otherwise delete.

- [ ] **Step 2: Search for any remaining references to deleted files**

Run: `grep -r "SupermarketCard\|category-matcher\|CategoryKey\|CATEGORY_DEFS\|FALLBACK_CATEGORY\|DEFAULT_SUPERMARKETS\|UNDELETABLE_SUPERMARKET_ID" src/ --include="*.ts" --include="*.tsx"`

Fix any remaining references found.

- [ ] **Step 3: Update all route paths**

In `src/App.tsx`:
- `/manage-markets` → `/manage-stores` (if not done in Task 9)
- Ensure all routes use translated copy via i18n

- [ ] **Step 4: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Run the app and smoke test all flows**

Run: `npm run dev`

Verify:
1. Main list page loads with journal style, tabs, store cards with icon grids
2. "一起买" button opens share sheet
3. ⚙ opens settings drawer
4. "去购物" enters shopping mode with image+text layout
5. Bought items fade and sink to bottom in shopping mode
6. "结束购物" saves to history
7. "历史" tab shows purchase history
8. Adding items works (no category selection)
9. ManageStores works (text-only stores)

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: remove dead code (SupermarketCard, category-matcher, old constants)"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Rename Supermarket → Store type | types/*.ts |
| 2 | Remove categories, simplify group-items | utils/constants.ts, utils/group-items.ts |
| 3 | i18n setup (zh-CN, zh-TW, en) | src/i18n.ts, src/locales/*.json |
| 4 | Journal-style visual theme | styles/theme.css, index.html |
| 5 | StoreCard + ItemGrid components | components/StoreCard.tsx, components/ItemGrid.tsx |
| 6 | Redesign List page (tabs, header) | routes/List.tsx |
| 7 | Redesign ShoppingMode (image+text, auto-sink) | routes/ShoppingMode.tsx |
| 8 | Rewrite Onboarding (language → stores → currency) | routes/Onboarding.tsx |
| 9 | Rename ManageMarkets → ManageStores | routes/ManageStores.tsx |
| 10 | Settings drawer | components/SettingsDrawer.tsx |
| 11 | Update AddSheet (remove categories) | components/AddSheet.tsx |
| 12 | Cleanup dead code | various |
