# 查超市（反向超市发现）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户「想买某商品但不知道去哪家超市」时，输入商品 → AI 映射店类型 → 原生 MapKit 搜附近 → 一键把店+商品落进现有清单。

**Architecture:** 三段管道（商品→AI店类型关键词→原生 MapKit 搜店）+ 一键落清单接回核心循环。**关键微调（相对 spec §5.2）**：Swift 插件收薄成「只跑 MKLocalSearch 返回原始 POI」，去重/距离/排序/匹配全部放在可被 vitest 单测的 TypeScript 里。iOS 独占，web/Android 隐藏入口。

**Tech Stack:** React 18 + TypeScript + Vite + Vitest；Supabase（Postgres + Edge Functions/Deno）；Capacitor 8（自写 Swift 插件 + `@capacitor/geolocation`）；Gemini 2.5 Flash（文本）；i18next。

---

## 文件结构

| 文件 | 职责 | 新建/修改 |
|---|---|---|
| `src/types/store.ts` | `Store` 加 `lat?/lng?/address?` | 修改 |
| `src/types/store-finder.ts` | 共享类型：`StoreTypeKeyword`、`StoreSearchResult`、`RankedStore`、`FoundStore` | 新建 |
| `src/lib/store-finder-utils.ts` | 纯逻辑：haversine / 选词 / 去重排序 / 匹配已有店（全部可单测） | 新建 |
| `src/lib/store-search-plugin.ts` | `registerPlugin` 声明 + 类型；web fallback 接入 | 新建 |
| `src/lib/store-search-web.ts` | web stub（dev/构建不崩） | 新建 |
| `src/lib/store-finder.ts` | 编排：调 Edge → 取定位 → 调插件 → 落清单 | 新建 |
| `src/lib/platform.ts` | `isStoreFinderAvailable()`（iOS-only 门控） | 新建 |
| `src/routes/StoreFinder.tsx` | 结果页：商品输入 + 店卡列表 + 点选落清单 | 新建 |
| `src/App.tsx` | 注册 `/store-finder` 路由 | 修改 |
| `src/components/AddSheet.tsx` | 选店步骤加「🔍 帮我找」主入口（仅 iOS 显示） | 修改 |
| `src/locales/{zh-CN,zh-TW,en}.json` | 新 `storeFinder` 命名空间 | 修改 |
| `supabase/migrations/013_store_finder.sql` | `store_type_hints` 缓存表 + `store_type_query_log` 计数表 | 新建 |
| `supabase/functions/resolve-store-types/index.ts` | Gemini 文本映射 + 缓存读写 + 全局限流降级 | 新建 |
| `scripts/seed-store-types.mjs` | 离线预填 276 presets 关键词 | 新建 |
| `ios/App/App/Plugins/StoreSearch.swift` | MKLocalSearch 桥（薄） | 新建 |
| `ios/App/App/Info.plist` | 加 `NSLocationWhenInUseUsageDescription` | 修改 |
| `docs/ROADMAP.md` | 同步路线图 | 修改 |

---

## Phase A — 数据模型 + 纯逻辑（TDD，web 可测）

### Task 1: 扩展 Store 类型 + 共享类型

**Files:**
- Modify: `src/types/store.ts`
- Create: `src/types/store-finder.ts`

- [ ] **Step 1: 扩展 Store**

`src/types/store.ts`：
```ts
export interface Store {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}
```

- [ ] **Step 2: 新建共享类型**

`src/types/store-finder.ts`：
```ts
/** AI 返回的店类型关键词，tier 越小越专门。 */
export interface StoreTypeKeyword {
  term: string;
  tier: number; // 1=最专门 2=大类 3=兜底通用
}

/** 原生 StoreSearch 插件返回的单条原始 POI（未去重、无距离）。 */
export interface StoreSearchResult {
  name: string;
  lat: number;
  lng: number;
  address: string;
  matchedTerm: string;
  category: string;
}

/** 去重 + 排序后、带距离的店，用于结果页展示。 */
export interface RankedStore extends StoreSearchResult {
  distanceMeters: number;
}

/** 用户点选、准备落清单的店。 */
export interface FoundStore {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 通过（无报错）

- [ ] **Step 4: Commit**

```bash
git add src/types/store.ts src/types/store-finder.ts
git commit -m "feat(store-finder): extend Store with coords + shared types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: haversine 距离

**Files:**
- Create: `src/lib/store-finder-utils.ts`
- Test: `src/lib/__tests__/store-finder-utils.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/__tests__/store-finder-utils.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../store-finder-utils';

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters({ lat: 31.23, lng: 121.47 }, { lat: 31.23, lng: 121.47 })).toBeLessThan(1);
  });

  it('computes a known distance (~1.11km per 0.01° latitude)', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -- store-finder-utils`
Expected: FAIL（`haversineMeters` 未定义）

- [ ] **Step 3: 最小实现**

`src/lib/store-finder-utils.ts`：
```ts
export interface LatLng { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test -- store-finder-utils`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-finder-utils.ts src/lib/__tests__/store-finder-utils.test.ts
git commit -m "feat(store-finder): haversine distance util

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 选搜索词（tier 选择）

**Files:**
- Modify: `src/lib/store-finder-utils.ts`
- Test: `src/lib/__tests__/store-finder-utils.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `store-finder-utils.test.ts` 追加：
```ts
import { selectSearchTerms } from '../store-finder-utils';

describe('selectSearchTerms', () => {
  const kw = [
    { term: '大型超市', tier: 3 },
    { term: '日系超市', tier: 1 },
    { term: '亚洲超市', tier: 2 },
    { term: 'Asian supermarket', tier: 2 },
    { term: 'Japanese grocery', tier: 1 },
  ];

  it('keeps only tier<=2, sorted by tier, capped', () => {
    expect(selectSearchTerms(kw, 4)).toEqual([
      '日系超市', 'Japanese grocery', '亚洲超市', 'Asian supermarket',
    ]);
  });

  it('falls back to all terms when none are tier<=2', () => {
    expect(selectSearchTerms([{ term: '超市', tier: 3 }], 4)).toEqual(['超市']);
  });

  it('dedups identical terms', () => {
    expect(selectSearchTerms([{ term: '超市', tier: 1 }, { term: '超市', tier: 2 }], 4)).toEqual(['超市']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -- store-finder-utils`
Expected: FAIL（`selectSearchTerms` 未定义）

- [ ] **Step 3: 实现**

在 `store-finder-utils.ts` 追加：
```ts
import type { StoreTypeKeyword } from '@/types/store-finder';

export function selectSearchTerms(keywords: StoreTypeKeyword[], max = 4): string[] {
  const sorted = [...keywords].sort((a, b) => a.tier - b.tier);
  const primary = sorted.filter((k) => k.tier <= 2).map((k) => k.term);
  const terms = primary.length ? primary : sorted.map((k) => k.term);
  return [...new Set(terms)].slice(0, max);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test -- store-finder-utils`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-finder-utils.ts src/lib/__tests__/store-finder-utils.test.ts
git commit -m "feat(store-finder): tiered search-term selection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 去重 + 距离 + 排序

**Files:**
- Modify: `src/lib/store-finder-utils.ts`
- Test: `src/lib/__tests__/store-finder-utils.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { dedupeAndRank } from '../store-finder-utils';
import type { StoreSearchResult } from '@/types/store-finder';

describe('dedupeAndRank', () => {
  const user = { lat: 0, lng: 0 };
  const mk = (o: Partial<StoreSearchResult>): StoreSearchResult => ({
    name: 'X', lat: 0, lng: 0, address: '', matchedTerm: '超市', category: '', ...o,
  });

  it('attaches distance and sorts nearest first', () => {
    const out = dedupeAndRank([
      mk({ name: 'Far', lat: 0.02, lng: 0 }),
      mk({ name: 'Near', lat: 0.001, lng: 0 }),
    ], user);
    expect(out.map((s) => s.name)).toEqual(['Near', 'Far']);
    expect(out[0].distanceMeters).toBeGreaterThan(0);
  });

  it('drops same-name results within 50m of an already-kept one', () => {
    const out = dedupeAndRank([
      mk({ name: '大华超市', lat: 0.0001, lng: 0 }),
      mk({ name: '大华超市', lat: 0.0002, lng: 0 }), // ~22m away → dup
    ], user);
    expect(out).toHaveLength(1);
  });

  it('keeps same-name results that are far apart (different branches)', () => {
    const out = dedupeAndRank([
      mk({ name: '大华超市', lat: 0, lng: 0 }),
      mk({ name: '大华超市', lat: 0.05, lng: 0 }), // ~5.5km → different branch
    ], user);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -- store-finder-utils`
Expected: FAIL（`dedupeAndRank` 未定义）

- [ ] **Step 3: 实现**

在 `store-finder-utils.ts` 追加（顶部已 import haversine 同文件、normalizeName 需引入）：
```ts
import { normalizeName } from '@/utils/normalize-name';
import type { StoreSearchResult, RankedStore } from '@/types/store-finder';

export function dedupeAndRank(raw: StoreSearchResult[], user: LatLng): RankedStore[] {
  const kept: RankedStore[] = [];
  for (const r of raw) {
    const isDup = kept.some(
      (k) =>
        normalizeName(k.name) === normalizeName(r.name) &&
        haversineMeters({ lat: k.lat, lng: k.lng }, { lat: r.lat, lng: r.lng }) < 50
    );
    if (isDup) continue;
    kept.push({ ...r, distanceMeters: haversineMeters(user, { lat: r.lat, lng: r.lng }) });
  }
  kept.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return kept;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test -- store-finder-utils`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-finder-utils.ts src/lib/__tests__/store-finder-utils.test.ts
git commit -m "feat(store-finder): dedupe + distance-rank store results

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 匹配已有店（落清单时去重）

**Files:**
- Modify: `src/lib/store-finder-utils.ts`
- Test: `src/lib/__tests__/store-finder-utils.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { findMatchingStore } from '../store-finder-utils';
import type { Store } from '@/types/store';

describe('findMatchingStore', () => {
  const existing: Store[] = [
    { id: 'sm_a', name: '大华超市', lat: 0, lng: 0 },
    { id: 'sm_b', name: 'Costco' },
  ];

  it('matches by normalized name', () => {
    expect(findMatchingStore({ name: '大华超市' }, existing)?.id).toBe('sm_a');
  });

  it('matches by coordinates within 80m even if name differs', () => {
    expect(findMatchingStore({ name: 'DaHua', lat: 0.0003, lng: 0 }, existing)?.id).toBe('sm_a');
  });

  it('returns null when neither name nor coords match', () => {
    expect(findMatchingStore({ name: 'T&T', lat: 1, lng: 1 }, existing)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -- store-finder-utils`
Expected: FAIL（`findMatchingStore` 未定义）

- [ ] **Step 3: 实现**

在 `store-finder-utils.ts` 追加：
```ts
import type { Store } from '@/types/store';
import type { FoundStore } from '@/types/store-finder';

export function findMatchingStore(found: FoundStore, existing: Store[]): Store | null {
  for (const s of existing) {
    if (normalizeName(s.name) === normalizeName(found.name)) return s;
    if (
      s.lat != null && s.lng != null && found.lat != null && found.lng != null &&
      haversineMeters({ lat: s.lat, lng: s.lng }, { lat: found.lat, lng: found.lng }) < 80
    ) {
      return s;
    }
  }
  return null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test -- store-finder-utils`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-finder-utils.ts src/lib/__tests__/store-finder-utils.test.ts
git commit -m "feat(store-finder): match found store against existing stores

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — 后端（迁移 + Edge Function + 预填脚本）

### Task 6: Migration 013 — 缓存表 + 计数表

**Files:**
- Create: `supabase/migrations/013_store_finder.sql`

- [ ] **Step 1: 写迁移**

`supabase/migrations/013_store_finder.sql`：
```sql
-- 013_store_finder.sql
-- Reverse store-finder: shared product→store-type keyword cache + a tiny global
-- daily query counter (kept separate from ai_generation_log so it never inflates
-- the icon-generation quota).

-- Shared, NOT account-scoped: first global querier of a product pays the AI call,
-- everyone else reads the cached keywords for free.
CREATE TABLE store_type_hints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_normalized text UNIQUE NOT NULL,
  keywords        jsonb NOT NULL,         -- [{ "term": "...", "tier": 1 }, ...]
  source          text NOT NULL DEFAULT 'ai' CHECK (source IN ('seed', 'ai')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_type_hints ENABLE ROW LEVEL SECURITY;

-- Any authenticated/anon user can READ the shared cache.
CREATE POLICY store_type_hints_read ON store_type_hints
  FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE policy → only the Edge Function (service role) can write.

-- Global daily cost backstop counter (rarely hit thanks to caching).
CREATE TABLE store_type_query_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid        uuid,
  name_normalized text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_type_query_log_created ON store_type_query_log (created_at);

ALTER TABLE store_type_query_log ENABLE ROW LEVEL SECURITY;
-- No policies → only the Edge Function (service role) reads/writes it.
```

- [ ] **Step 2: 本地应用迁移**

Run: `npx supabase db push`（或项目既定的迁移命令；与 012 同流程）
Expected: 迁移成功，`store_type_hints` / `store_type_query_log` 两表创建

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_store_finder.sql
git commit -m "feat(store-finder): migration 013 — keyword cache + query counter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Edge Function `resolve-store-types`

**Files:**
- Create: `supabase/functions/resolve-store-types/index.ts`

> 照搬 `generate-icon/index.ts` 的 CORS / JWT / jsonResponse 样板。逻辑：归一化 → 查缓存命中即返回 → 未命中查全局上限（满则返回兜底通用词，不硬失败）→ 调 Gemini 文本 → 解析 → 写缓存 + 计数 → 返回。

- [ ] **Step 1: 写 Edge Function**

`supabase/functions/resolve-store-types/index.ts`：
```ts
// supabase/functions/resolve-store-types/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const DAILY_GLOBAL_LIMIT = 100; // cost backstop; rarely hit thanks to the cache
const FALLBACK: Keyword[] = [
  { term: '超市', tier: 3 },
  { term: 'supermarket', tier: 3 },
];

interface Keyword { term: string; tier: number }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Same lightweight trad→simp normalization spirit as src/utils/normalize-name.ts.
function normalize(name: string): string {
  return name.trim().replace(/\s+/g, '').slice(0, 40);
}

const PROMPT = `你是购物助手。用户想买一件商品，告诉我哪些"店类型"最可能卖它。
商品：{item}
返回一个 JSON 数组，每项 {"term": 店类型搜索词, "tier": 1|2|3}：
- tier 1 = 最专门最可能（如"日系超市"）
- tier 2 = 较可能的大类（如"亚洲超市""进口食品店"）
- tier 3 = 兜底通用（如"超市"）
- 中英文搜索词都要给（覆盖中国大城市与北美华人区）
- 6~8 项，按 tier 升序
只返回 JSON 数组本身，不要其它文字。`;

function parseKeywords(text: string): Keyword[] {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((k) => k && typeof k.term === 'string' && Number.isFinite(k.tier))
      .map((k) => ({ term: String(k.term).slice(0, 40), tier: Math.min(3, Math.max(1, k.tier)) }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authErr } = await anon.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return jsonResponse({ error: 'invalid_input', message: 'name required' }, 400);
    }
    const key = normalize(name);
    if (!key) return jsonResponse({ error: 'invalid_input' }, 400);

    // 1. Cache hit → free
    const { data: cached } = await service
      .from('store_type_hints').select('keywords').eq('name_normalized', key).maybeSingle();
    if (cached) return jsonResponse({ keywords: cached.keywords, source: 'cache' });

    // 2. Global daily backstop → degrade to generic, don't hard-fail
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count } = await service
      .from('store_type_query_log').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    if ((count ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return jsonResponse({ keywords: FALLBACK, source: 'fallback_limit' });
    }

    // 3. Gemini text call (JSON mode)
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace('{item}', key) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      console.error('Gemini error:', await res.text());
      return jsonResponse({ keywords: FALLBACK, source: 'fallback_error' });
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const keywords = parseKeywords(text);
    if (!keywords.length) return jsonResponse({ keywords: FALLBACK, source: 'fallback_parse' });

    // 4. Persist to shared cache + counter (best-effort; ignore write races)
    await service.from('store_type_hints')
      .upsert({ name_normalized: key, keywords, source: 'ai' }, { onConflict: 'name_normalized' });
    await service.from('store_type_query_log').insert({ user_uid: user.id, name_normalized: key });

    return jsonResponse({ keywords, source: 'ai' });
  } catch (err) {
    console.error('resolve-store-types error:', err);
    return jsonResponse({ keywords: FALLBACK, source: 'fallback_exception' }, 200);
  }
});
```

- [ ] **Step 2: 本地部署 / 冒烟**

Run: `npx supabase functions deploy resolve-store-types`，然后用真实 JWT 调一次：
```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/resolve-store-types" \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"name":"日本酱油"}'
```
Expected: 返回 `{"keywords":[{"term":"日系超市","tier":1}, ...],"source":"ai"}`；再调一次同商品返回 `"source":"cache"`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/resolve-store-types/index.ts
git commit -m "feat(store-finder): resolve-store-types Edge Function (Gemini + cache)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 预填脚本 `seed-store-types.mjs`

**Files:**
- Create: `scripts/seed-store-types.mjs`
- Modify: `package.json`（加 script）

> 照 `scripts/generate-item-icons.mjs` 模式：读 276 preset 商品名，对每个调 Gemini 文本，写入 `store_type_hints`（source='seed'）。用 service role key（脚本本地跑，不走 Edge）。

- [ ] **Step 1: 写脚本**

`scripts/seed-store-types.mjs`：
```js
// Offline one-time seed: preset item names → store_type_hints (source='seed').
// Run locally with env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { UNIQUE_ICON_ITEMS } from '../src/utils/icon-registry.ts';

const { GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PROMPT = `你是购物助手。用户想买一件商品，告诉我哪些"店类型"最可能卖它。
商品：{item}
返回一个 JSON 数组，每项 {"term": 店类型搜索词, "tier": 1|2|3}（tier1最专门，tier3兜底通用），
中英文都要，6~8 项按 tier 升序。只返回 JSON 数组。`;

const normalize = (s) => s.trim().replace(/\s+/g, '').slice(0, 40);

async function resolve(name) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace('{item}', name) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  const data = await res.json();
  return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]');
}

const names = [...new Set(UNIQUE_ICON_ITEMS.map((i) => i.name))];
let done = 0;
for (const name of names) {
  const key = normalize(name);
  const { data: hit } = await supabase
    .from('store_type_hints').select('id').eq('name_normalized', key).maybeSingle();
  if (hit) { done++; continue; } // resumable
  try {
    const keywords = await resolve(name);
    if (Array.isArray(keywords) && keywords.length) {
      await supabase.from('store_type_hints')
        .upsert({ name_normalized: key, keywords, source: 'seed' }, { onConflict: 'name_normalized' });
    }
  } catch (e) {
    console.error('skip', name, e.message);
  }
  done++;
  console.log(`${done}/${names.length}  ${name}`);
}
console.log('seed complete');
```

- [ ] **Step 2: 加 npm script**

`package.json` scripts 块加：
```json
"seed-store-types": "node --experimental-strip-types scripts/seed-store-types.mjs"
```
（若 Node 版本不支持 strip-types，改为先把 `UNIQUE_ICON_ITEMS` 名称导出到一个 `.json`，脚本读 json；与 generate-item-icons.mjs 的取数方式保持一致。）

- [ ] **Step 3: 运行预填**

Run: `npm run seed-store-types`
Expected: 打印 `1/276 ... 276/276`，`store_type_hints` 出现 ~276 行 `source='seed'`；可重复运行（已存在的跳过）

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-store-types.mjs package.json
git commit -m "feat(store-finder): offline seed script for preset store-type hints

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — 原生（Capacitor，真机冒烟）

### Task 9: 装定位插件 + Info.plist 权限

**Files:**
- Modify: `package.json`（依赖）
- Modify: `ios/App/App/Info.plist`

- [ ] **Step 1: 安装 `@capacitor/geolocation`**

Run: `npm install @capacitor/geolocation@^8`
Expected: package.json dependencies 出现 `@capacitor/geolocation`

- [ ] **Step 2: 加定位权限说明**

`ios/App/App/Info.plist`，在顶层 `<dict>` 内加：
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>买啥需要你的位置，帮你找附近卖这件商品的超市。</string>
```

- [ ] **Step 3: 同步到 iOS**

Run: `npm run cap:sync`
Expected: 同步成功，geolocation 插件被纳入 iOS 工程

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios/App/App/Info.plist
git commit -m "feat(store-finder): add @capacitor/geolocation + location usage string

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Swift 插件 `StoreSearch`（薄：只跑 MKLocalSearch 返回原始 POI）

**Files:**
- Create: `ios/App/App/Plugins/StoreSearch.swift`

> 插件不做去重/排序/距离（那些在 TS）。对每个 query 跑一次 `MKLocalSearch`，把命中的 POI 拍平返回，附 `matchedTerm`。

- [ ] **Step 1: 写 Swift 插件**

`ios/App/App/Plugins/StoreSearch.swift`：
```swift
import Foundation
import Capacitor
import MapKit

@objc(StoreSearch)
public class StoreSearch: CAPPlugin {
    @objc func search(_ call: CAPPluginCall) {
        let queries = call.getArray("queries", String.self) ?? []
        let lat = call.getDouble("lat") ?? 0
        let lng = call.getDouble("lng") ?? 0
        let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        let region = MKCoordinateRegion(center: center,
            latitudinalMeters: 8000, longitudinalMeters: 8000)

        let group = DispatchGroup()
        var collected: [[String: Any]] = []
        let lock = NSLock()

        for term in queries {
            group.enter()
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = term
            request.region = region
            MKLocalSearch(request: request).start { response, _ in
                defer { group.leave() }
                guard let items = response?.mapItems else { return }
                lock.lock()
                for item in items.prefix(10) {
                    let p = item.placemark
                    collected.append([
                        "name": item.name ?? "",
                        "lat": p.coordinate.latitude,
                        "lng": p.coordinate.longitude,
                        "address": [p.thoroughfare, p.locality].compactMap { $0 }.joined(separator: " "),
                        "matchedTerm": term,
                        "category": item.pointOfInterestCategory?.rawValue ?? ""
                    ])
                }
                lock.unlock()
            }
        }

        group.notify(queue: .main) {
            call.resolve(["results": collected])
        }
    }
}
```

- [ ] **Step 2: 注册插件（Capacitor 8 自动发现 @objc 插件；确认 .m 桥或 SPM 暴露）**

确认 `ios/App/App/Plugins/StoreSearch.swift` 被 Xcode target 编译。Capacitor 8 通过 `@objc(StoreSearch)` + `CAPPluginMethod` 自动注册；若工程使用旧式注册，补一个 `StoreSearch.m`：
```objc
#import <Capacitor/Capacitor.h>
CAP_PLUGIN(StoreSearch, "StoreSearch",
  CAP_PLUGIN_METHOD(search, CAPPluginReturnPromise);
)
```

- [ ] **Step 3: 构建 iOS 确认编译**

Run: `npm run cap:build && npx cap open ios`，在 Xcode build（⌘B）
Expected: 编译通过，无 MapKit 链接错误（MapKit 随 import 自动链接）

- [ ] **Step 4: Commit**

```bash
git add ios/App/App/Plugins/
git commit -m "feat(store-finder): native StoreSearch Capacitor plugin (MKLocalSearch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: 插件 TS 接口 + web stub + 平台门控

**Files:**
- Create: `src/lib/store-search-plugin.ts`
- Create: `src/lib/store-search-web.ts`
- Create: `src/lib/platform.ts`
- Test: `src/lib/__tests__/platform.test.ts`

- [ ] **Step 1: 写插件 TS 声明**

`src/lib/store-search-plugin.ts`：
```ts
import { registerPlugin } from '@capacitor/core';
import type { StoreSearchResult } from '@/types/store-finder';

export interface StoreSearchPlugin {
  search(options: { queries: string[]; lat: number; lng: number }): Promise<{ results: StoreSearchResult[] }>;
}

export const StoreSearch = registerPlugin<StoreSearchPlugin>('StoreSearch', {
  web: () => import('./store-search-web').then((m) => new m.StoreSearchWeb()),
});
```

- [ ] **Step 2: 写 web stub**

`src/lib/store-search-web.ts`：
```ts
import { WebPlugin } from '@capacitor/core';
import type { StoreSearchPlugin } from './store-search-plugin';

// Web has no MapKit; the feature's entry points are hidden off-iOS (see platform.ts),
// so this only exists to keep registerPlugin from throwing during dev/build.
export class StoreSearchWeb extends WebPlugin implements StoreSearchPlugin {
  async search(): Promise<{ results: [] }> {
    return { results: [] };
  }
}
```

- [ ] **Step 3: 写平台门控 + 失败测试**

`src/lib/__tests__/platform.test.ts`：
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => vi.restoreAllMocks());

describe('isStoreFinderAvailable', () => {
  it('true on ios', async () => {
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
    const { isStoreFinderAvailable } = await import('../platform');
    expect(isStoreFinderAvailable()).toBe(true);
  });

  it('false on web', async () => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' } }));
    const { isStoreFinderAvailable } = await import('../platform');
    expect(isStoreFinderAvailable()).toBe(false);
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `npm run test -- platform`
Expected: FAIL（`../platform` 不存在）

- [ ] **Step 5: 实现 platform.ts**

`src/lib/platform.ts`：
```ts
import { Capacitor } from '@capacitor/core';

/** Store-finder is iOS-only (MapKit). Entry points hide elsewhere. */
export function isStoreFinderAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios';
}
```

- [ ] **Step 6: 跑测试确认通过 + typecheck**

Run: `npm run test -- platform && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/store-search-plugin.ts src/lib/store-search-web.ts src/lib/platform.ts src/lib/__tests__/platform.test.ts
git commit -m "feat(store-finder): plugin TS interface + web stub + iOS gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — 前端编排 + UI

### Task 12: 编排层 `store-finder.ts`（落清单逻辑可测）

**Files:**
- Create: `src/lib/store-finder.ts`
- Test: `src/lib/__tests__/store-finder.test.ts`

- [ ] **Step 1: 写失败测试（聚焦 commitStoreChoice 的「加新店 / 复用旧店」分支）**

`src/lib/__tests__/store-finder.test.ts`：
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { List } from '@/types/list';

vi.mock('@/lib/db', () => ({
  updateListSupermarkets: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
}));
import { updateListSupermarkets, addItem } from '@/lib/db';
import { commitStoreChoice } from '../store-finder';

const baseList = {
  id: 'list-1',
  supermarkets: [{ id: 'sm_a', name: '大华超市', lat: 0, lng: 0 }],
} as unknown as List;

beforeEach(() => vi.clearAllMocks());

describe('commitStoreChoice', () => {
  it('reuses an existing store (no supermarkets update) and adds the item to it', async () => {
    await commitStoreChoice(baseList, 'uid-1', '日本酱油', { name: '大华超市', lat: 0, lng: 0 });
    expect(updateListSupermarkets).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledWith('list-1', 'uid-1', { name: '日本酱油', supermarket: 'sm_a' });
  });

  it('adds a new store, then adds the item to the new store id', async () => {
    await commitStoreChoice(baseList, 'uid-1', '寿司醋', { name: 'T&T 大统华', lat: 1, lng: 1, address: '99 Rd' });
    expect(updateListSupermarkets).toHaveBeenCalledTimes(1);
    const [listId, stores] = (updateListSupermarkets as any).mock.calls[0];
    expect(listId).toBe('list-1');
    expect(stores).toHaveLength(2);
    const added = stores[1];
    expect(added.name).toBe('T&T 大统华');
    expect((addItem as any).mock.calls[0][2].supermarket).toBe(added.id);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -- store-finder.test`
Expected: FAIL（`commitStoreChoice` 未定义）

- [ ] **Step 3: 实现编排层**

`src/lib/store-finder.ts`：
```ts
import { supabase } from './supabase';
import { updateListSupermarkets, addItem } from './db';
import { selectSearchTerms, dedupeAndRank, findMatchingStore } from './store-finder-utils';
import { StoreSearch } from './store-search-plugin';
import type { List } from '@/types/list';
import type { Store } from '@/types/store';
import type { StoreTypeKeyword, RankedStore, FoundStore } from '@/types/store-finder';

const FALLBACK: StoreTypeKeyword[] = [
  { term: '超市', tier: 3 },
  { term: 'supermarket', tier: 3 },
];

/** 商品 → 店类型关键词（走 Edge Function；失败降级通用词）。 */
export async function resolveStoreTypes(name: string): Promise<StoreTypeKeyword[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-store-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return Array.isArray(data.keywords) && data.keywords.length ? data.keywords : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** 用关键词在用户位置附近搜店，返回去重排序后的店列表。 */
export async function findStoresFor(name: string, loc: { lat: number; lng: number }): Promise<RankedStore[]> {
  const keywords = await resolveStoreTypes(name);
  const terms = selectSearchTerms(keywords, 4);
  const { results } = await StoreSearch.search({ queries: terms, lat: loc.lat, lng: loc.lng });
  return dedupeAndRank(results, loc);
}

/** 点选一家店：已有则复用，否则加进清单的超市，再把商品加到该店。 */
export async function commitStoreChoice(
  list: List,
  uid: string,
  productName: string,
  chosen: FoundStore
): Promise<void> {
  const existing: Store[] = list.supermarkets ?? [];
  let store = findMatchingStore(chosen, existing);
  if (!store) {
    store = {
      id: 'sm_' + Date.now().toString(36),
      name: chosen.name,
      lat: chosen.lat,
      lng: chosen.lng,
      address: chosen.address,
    };
    await updateListSupermarkets(list.id, [...existing, store]);
  }
  await addItem(list.id, uid, { name: productName, supermarket: store.id });
}
```

- [ ] **Step 4: 跑测试确认通过 + typecheck**

Run: `npm run test -- store-finder.test && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/store-finder.ts src/lib/__tests__/store-finder.test.ts
git commit -m "feat(store-finder): orchestration layer (resolve→search→commit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: i18n — `storeFinder` 命名空间

**Files:**
- Modify: `src/locales/zh-CN.json`, `src/locales/zh-TW.json`, `src/locales/en.json`

- [ ] **Step 1: zh-CN**

`src/locales/zh-CN.json` 顶层加：
```json
"storeFinder": {
  "title": "去哪买",
  "entryHint": "不知道去哪买？帮我找",
  "searchPlaceholder": "想买什么？",
  "locating": "正在定位…",
  "searching": "正在找附近的店…",
  "locationDenied": "需要定位才能找附近超市",
  "openSettings": "去开启定位",
  "offline": "查超市需要联网",
  "distanceKm": "{{km}} 公里",
  "noResults": "附近没找到卖「{{item}}」的店",
  "addManually": "手动添加超市",
  "added": "已把「{{item}}」加到「{{store}}」"
}
```

- [ ] **Step 2: zh-TW**

`src/locales/zh-TW.json` 顶层加：
```json
"storeFinder": {
  "title": "去哪買",
  "entryHint": "不知道去哪買？幫我找",
  "searchPlaceholder": "想買什麼？",
  "locating": "正在定位…",
  "searching": "正在找附近的店…",
  "locationDenied": "需要定位才能找附近超市",
  "openSettings": "去開啟定位",
  "offline": "查超市需要連網",
  "distanceKm": "{{km}} 公里",
  "noResults": "附近沒找到賣「{{item}}」的店",
  "addManually": "手動新增超市",
  "added": "已把「{{item}}」加到「{{store}}」"
}
```

- [ ] **Step 3: en**

`src/locales/en.json` 顶层加：
```json
"storeFinder": {
  "title": "Where to buy",
  "entryHint": "Not sure where? Find a store",
  "searchPlaceholder": "What do you want to buy?",
  "locating": "Locating…",
  "searching": "Finding nearby stores…",
  "locationDenied": "Location is needed to find nearby stores",
  "openSettings": "Enable location",
  "offline": "Finding stores needs an internet connection",
  "distanceKm": "{{km}} km",
  "noResults": "No nearby store found for \"{{item}}\"",
  "addManually": "Add a store manually",
  "added": "Added \"{{item}}\" to \"{{store}}\""
}
```

- [ ] **Step 4: typecheck + 测试回归**

Run: `npm run typecheck && npm run test`
Expected: PASS（JSON 合法、无回归）

- [ ] **Step 5: Commit**

```bash
git add src/locales/zh-CN.json src/locales/zh-TW.json src/locales/en.json
git commit -m "feat(store-finder): i18n storeFinder namespace (zh-CN/zh-TW/en)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: 结果页 `StoreFinder.tsx` + 路由

**Files:**
- Create: `src/routes/StoreFinder.tsx`
- Modify: `src/App.tsx`

> 页面状态机：`input`（输入/选商品）→ `loading`（定位+搜店）→ `results` / `empty` / `error(denied|offline)`。商品输入复用 icon-registry 的 `matchesIconQuery` + `UNIQUE_ICON_ITEMS` 做建议；图标用 `resolveIconUrl`，无则 `WatercolorFallback`（与 AddSheet 同源）。

- [ ] **Step 1: 写页面**

`src/routes/StoreFinder.tsx`：
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '@/hooks/useAuth';
import { useList } from '@/hooks/useList';
import { findStoresFor, commitStoreChoice } from '@/lib/store-finder';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { resolveIconUrl } from '@/utils/icon-registry';
import type { RankedStore } from '@/types/store-finder';

type Phase = 'input' | 'loading' | 'results' | 'empty' | 'denied' | 'offline';

export default function StoreFinder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid } = useAuth();
  const { list } = useList(uid);
  const [product, setProduct] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [stores, setStores] = useState<RankedStore[]>([]);

  async function run(name: string) {
    if (!name.trim()) return;
    setProduct(name);
    setPhase('loading');
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') { setPhase('denied'); return; }
      const pos = await Geolocation.getCurrentPosition();
      const found = await findStoresFor(name, {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
      });
      setStores(found);
      setPhase(found.length ? 'results' : 'empty');
    } catch (e) {
      setPhase(navigator.onLine ? 'denied' : 'offline');
    }
  }

  async function pick(s: RankedStore) {
    if (!list) return;
    await commitStoreChoice(list, uid, product, {
      name: s.name, lat: s.lat, lng: s.lng, address: s.address,
    });
    navigate('/list');
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>{t('storeFinder.title')}</h2>

      {phase === 'input' && (
        <input
          autoFocus
          placeholder={t('storeFinder.searchPlaceholder')}
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(product); }}
          style={{ width: '100%', padding: 12, borderRadius: 'var(--radius-card)' }}
        />
      )}

      {phase === 'loading' && <p>{t('storeFinder.searching')}</p>}
      {phase === 'denied' && (
        <div>
          <p>{t('storeFinder.locationDenied')}</p>
          <button onClick={() => setPhase('input')}>{t('common.back')}</button>
        </div>
      )}
      {phase === 'offline' && <p>{t('storeFinder.offline')}</p>}
      {phase === 'empty' && (
        <div>
          <p>{t('storeFinder.noResults', { item: product })}</p>
          <button onClick={() => navigate('/manage-stores')}>{t('storeFinder.addManually')}</button>
        </div>
      )}

      {phase === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {resolveIconUrl(product)
              ? <img src={resolveIconUrl(product)!} width={36} height={36} alt="" />
              : <WatercolorFallback name={product} size={36} />}
            <strong>{product}</strong>
          </div>
          {stores.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              onClick={() => pick(s)}
              style={{
                textAlign: 'left', padding: 14, background: 'var(--paper)',
                borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', border: 'none',
              }}
            >
              <div style={{ fontWeight: 600 }}>
                🏪 {s.name}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-light)' }}>· {s.matchedTerm}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-light)' }}>
                  · {t('storeFinder.distanceKm', { km: (s.distanceMeters / 1000).toFixed(1) })}
                </span>
              </div>
              {s.address && <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>{s.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

> 注：`resolveIconUrl` 的精确签名以 `src/utils/icon-registry.ts` 为准；若它需要 customIconMap 第二参，传 `undefined` 走 preset/watercolor 路径即可（StoreFinder 不引入自定义图标）。`useAuth`/`useList` 用法对齐 `List.tsx`。

- [ ] **Step 2: 注册路由**

`src/App.tsx` 的 `AuthedApp` Routes 块加（与既有路由同样式）：
```tsx
import StoreFinder from '@/routes/StoreFinder';
// ...
<Route path="/store-finder" element={<StoreFinder />} />
```

- [ ] **Step 3: 构建确认**

Run: `npm run build`
Expected: 构建通过（tsc + vite）

- [ ] **Step 4: Commit**

```bash
git add src/routes/StoreFinder.tsx src/App.tsx
git commit -m "feat(store-finder): results page + /store-finder route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: AddSheet 主入口（仅 iOS 显示）

**Files:**
- Modify: `src/components/AddSheet.tsx`

> 在 AddSheet 的「选店」步骤渲染处（recon 指出约 `AddSheet.tsx:466-508` 的 store 选择列表），当 `isStoreFinderAvailable()` 为真时，在列表顶部加一条「🔍 帮我找」行，点击 `navigate('/store-finder')` 并关闭 sheet。

- [ ] **Step 1: 引入门控 + 导航**

`src/components/AddSheet.tsx` 顶部 imports 加：
```ts
import { isStoreFinderAvailable } from '@/lib/platform';
import { useNavigate } from 'react-router-dom';
```
组件内（若尚无 navigate）：
```ts
const navigate = useNavigate();
```

- [ ] **Step 2: 在选店列表顶部插入入口行**

在 store 选择列表（map 渲染各 Store 之前）插入：
```tsx
{isStoreFinderAvailable() && (
  <button
    type="button"
    onClick={() => { onClose(); navigate('/store-finder'); }}
    style={{
      width: '100%', textAlign: 'left', padding: 12, marginBottom: 8,
      background: 'var(--paper)', border: '1px dashed var(--ink-light)',
      borderRadius: 'var(--radius-card)',
    }}
  >
    🔍 {t('storeFinder.entryHint')}
  </button>
)}
```
> `onClose` 用 AddSheet 既有的关闭回调名（若不同，对齐实际 prop）。`t` 来自组件已有的 `useTranslation()`。

- [ ] **Step 3: 构建 + 测试回归**

Run: `npm run build && npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/AddSheet.tsx
git commit -m "feat(store-finder): AddSheet 'find a store' entry (iOS only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — 真机冒烟 + 收尾

### Task 16: iOS 真机端到端冒烟

**Files:** 无（验证）

- [ ] **Step 1: 构建并在真机/模拟器运行**

Run: `npm run cap:build && npx cap open ios` → Xcode 选真机 → Run

- [ ] **Step 2: 走完整漏斗**

手动验证：
1. 在某清单点「加东西」→ 选店步骤出现「🔍 不知道去哪买？帮我找」
2. 点它 → 进 `/store-finder`
3. 输入「日本酱油」→ 回车 → 弹定位授权 → 允许
4. 出现按距离排序的店卡（店名 · 店类型 · X 公里 · 地址）
5. 点一家 → 跳回 `/list` → 「日本酱油」出现在该店分组下
6. 再查同商品 → 观察 Edge Function 日志 `source=cache`（秒回）
7. 拒绝定位的清况 → 出现「需要定位才能找附近超市」+ 返回按钮（不崩）

Expected: 七步全过

- [ ] **Step 3: Web 回归（确认入口隐藏）**

Run: `npm run dev` → 浏览器打开 → 「加东西」选店步骤**不**出现「帮我找」入口（`isStoreFinderAvailable()` 为 false）
Expected: web 无该入口，应用不崩

---

### Task 17: 同步 ROADMAP + 收尾

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: 更新 ROADMAP**

`docs/ROADMAP.md`「✅ 已上线」顶部加一节（日期取实际落地日）：
```markdown
### 🆕 查超市（反向超市发现）v1（落地）

「想买某商品但不知道去哪家」的反向入口：输入商品 → AI 映射店类型（Gemini 文本 + store_type_hints 共享缓存，276 presets 已预填）→ 原生 MapKit MKLocalSearch 搜附近（iOS 独占，国内走高德/北美走 Apple 数据，免费）→ 一键把店+商品落进清单，接回核心循环。

- spec: [superpowers/specs/2026-06-14-store-finder-design.md](superpowers/specs/2026-06-14-store-finder-design.md)
- plan: [superpowers/plans/2026-06-14-store-finder.md](superpowers/plans/2026-06-14-store-finder.md)
- migration 013 已应用（store_type_hints + store_type_query_log）
- v2 待办：B/C 输入（自然语言/多商品）、拒绝定位手输城市降级、地图导航
```
同时从「📋 待办 / 🗺️ 路线图」移除对应条目（如有）。

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): store-finder v1 landed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 自审记录

- **Spec 覆盖**：§5.1 AI桥+缓存→Task 6/7/8；§5.2 原生→Task 9/10/11；§5.3 编排→Task 12；§6 入口/结果页/落清单→Task 14/15；§7 数据模型→Task 1/6；§8 错误处理→Edge 降级(Task 7)+ 页面 denied/offline/empty(Task 14)；§9 测试→Task 2-5/11/12 单测 + Task 16 真机冒烟；§10 i18n→Task 13；§12 改动清单全覆盖；§13 ROADMAP→Task 17。
- **微调记录**：spec §5.2 让 Swift 做去重/排序，本计划改为 Swift 仅返回原始 POI、去重排序在 TS（Task 4/10）——提升可测性、减少原生代码，结果等价。
- **类型一致**：`StoreTypeKeyword{term,tier}` / `StoreSearchResult` / `RankedStore` / `FoundStore` 贯穿 Task 1/4/7/10/12；`commitStoreChoice` 签名 Task 12 定义、Task 14 调用一致；`findStoresFor`/`resolveStoreTypes` 命名一致。
- **限流隔离**：用独立 `store_type_query_log`，不碰 `ai_generation_log`，杜绝拉低图标配额的回归（比 spec 的"或加 kind 列"更安全）。
