# 钤印集章收藏系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成采购随机钤一枚朱红花印 → account 级集章本翻面看首钤回忆 → 4 枚季节限定窗印。

**Architecture:** spec 见 [2026-07-19-seal-collection-design.md](../specs/2026-07-19-seal-collection-design.md)。纯增量：migration 015 建 `seal_collection`（RLS、无 DELETE）；`src/lib/seals.ts` 承载 pickSeal 纯函数 + 读写；`SealImprint` 组件用 CSS mask 把现有 `public/flora/*.webp` 转朱红印记（零新资产）；ShoppingEndModal 保存成功后插入钤印揭晓视图；新路由 `/seals` 集章本（stagger 点亮 + count-up + card-flip）。触觉 `@capacitor/haptics`（web 降级）。

**Tech Stack:** React18+TS、Vitest、Supabase（RLS/upsert）、CSS mask/3D transform、@capacitor/haptics。仓库 `C:\dev\MaiSha`。

**印泥色** `#B0442C`。**发放**：常驻 8 = 兰lan/竹zhu/菊ju/松song/银杏yinxing/枫feng/紫藤ziteng/芦苇luwei；季节 4 = 水仙shuixian(02-01~03-15)/荷he(06-15~08-15)/桂gui(09-01~10-15)/梅mei(12-01~01-31 跨年)。

---

### Task 1: migration 015 — seal_collection 表

**Files:**
- Create: `supabase/migrations/015_seal_collection.sql`

- [ ] **Step 1: 写迁移**（风格对齐 014：小写 SQL + RLS to authenticated）

```sql
-- 015: 钤印集章——account 级收藏，印记不可逆（无 DELETE 策略）
-- spec: docs/superpowers/specs/2026-07-19-seal-collection-design.md

create table public.seal_collection (
  account_id uuid not null references public.accounts(id) on delete cascade,
  seal_id text not null,                    -- flora 成员 id，永不改名（单向门沿袭）
  first_earned_at timestamptz not null default now(),
  first_store text not null default '',     -- 首钤回忆三件套，只写一次
  first_item_count int not null default 0,
  times_earned int not null default 1,
  primary key (account_id, seal_id)
);

alter table public.seal_collection enable row level security;

create policy seal_select_own on public.seal_collection
  for select to authenticated
  using (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));

create policy seal_insert_own on public.seal_collection
  for insert to authenticated
  with check (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));

create policy seal_update_own on public.seal_collection
  for update to authenticated
  using (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));
-- 刻意无 delete 策略：钤下的印记不可逆
```

- [ ] **Step 2: 应用**（生产 schema 变更——spec 已获用户批准；执行时若有疑虑再确认一次）

Run: `cd /c/dev/MaiSha && npx supabase db push`
Expected: `Applying migration 015_seal_collection.sql... Finished.`

- [ ] **Step 3: Commit** `git add supabase/migrations/015_seal_collection.sql && git commit -m "feat(seals): migration 015——seal_collection 表，RLS 无 DELETE（印记不可逆）"`

### Task 2: pickSeal 纯函数（TDD）

**Files:**
- Create: `src/lib/seals.ts`
- Test: `src/lib/__tests__/seals.test.ts`

- [ ] **Step 1: 失败测试**

```ts
import { describe, it, expect } from 'vitest';
import { pickSeal, RESIDENT_SEALS, SEASONAL_SEALS } from '@/lib/seals';

const none = new Set<string>();

describe('pickSeal', () => {
  it('非窗口期：均匀随机常驻 8（rand 注入可控）', () => {
    const now = new Date('2026-04-20');           // 无窗
    expect(pickSeal(none, now, () => 0)).toBe(RESIDENT_SEALS[0]);
    expect(pickSeal(none, now, () => 0.99)).toBe(RESIDENT_SEALS[7]);
  });

  it('窗口期未拥有：必得季节印', () => {
    expect(pickSeal(none, new Date('2026-09-20'), () => 0.99)).toBe('gui');
    expect(pickSeal(none, new Date('2026-07-01'), () => 0.99)).toBe('he');
    expect(pickSeal(none, new Date('2026-02-10'), () => 0.99)).toBe('shuixian');
  });

  it('梅窗跨年：12 月与 1 月都命中', () => {
    expect(pickSeal(none, new Date('2026-12-15'), () => 0.99)).toBe('mei');
    expect(pickSeal(none, new Date('2027-01-20'), () => 0.99)).toBe('mei');
    expect(pickSeal(none, new Date('2027-02-10'), () => 0.99)).toBe('shuixian'); // 已出梅窗
  });

  it('窗口期已拥有：50% 再钤季节印 / 50% 落常驻', () => {
    const owned = new Set(['gui']);
    const now = new Date('2026-09-20');
    expect(pickSeal(owned, now, () => 0.4)).toBe('gui');          // <0.5 再钤
    expect(pickSeal(owned, now, () => 0.6)).toBe(RESIDENT_SEALS[Math.floor(0.6 * 8)]); // ≥0.5 落常驻
  });

  it('花名册完整且互斥', () => {
    expect(RESIDENT_SEALS).toHaveLength(8);
    expect(SEASONAL_SEALS.map(s => s.id)).toEqual(['shuixian', 'he', 'gui', 'mei']);
    expect(RESIDENT_SEALS.some(r => SEASONAL_SEALS.find(s => s.id === r))).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/seals.test.ts` → FAIL（模块不存在）
- [ ] **Step 3: 实现**

```ts
// 钤印集章：发放规则纯函数 + Supabase 读写。spec: docs/superpowers/specs/2026-07-19-seal-collection-design.md
// seal_id = flora 成员 id（decor-registry 同源），永不改名。
export const RESIDENT_SEALS = ['lan', 'zhu', 'ju', 'song', 'yinxing', 'feng', 'ziteng', 'luwei'] as const;

export interface SeasonalSeal { id: string; from: [number, number]; to: [number, number]; }
// 固定月日近似节气（精确历法 = Non-goal）；梅窗跨年
export const SEASONAL_SEALS: SeasonalSeal[] = [
  { id: 'shuixian', from: [2, 1],  to: [3, 15] },
  { id: 'he',       from: [6, 15], to: [8, 15] },
  { id: 'gui',      from: [9, 1],  to: [10, 15] },
  { id: 'mei',      from: [12, 1], to: [1, 31] },
];

function inWindow(now: Date, s: SeasonalSeal): boolean {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  const a = s.from[0] * 100 + s.from[1];
  const b = s.to[0] * 100 + s.to[1];
  return a <= b ? md >= a && md <= b : md >= a || md <= b;  // 跨年窗
}

export function pickSeal(
  owned: ReadonlySet<string>,
  now: Date,
  rand: () => number = Math.random
): string {
  const seasonal = SEASONAL_SEALS.find(s => inWindow(now, s));
  if (seasonal) {
    if (!owned.has(seasonal.id)) return seasonal.id;   // 窗口内未拥有必得
    if (rand() < 0.5) return seasonal.id;              // 已拥有：一半再钤（×N）
  }
  return RESIDENT_SEALS[Math.floor(rand() * RESIDENT_SEALS.length)];
}
```

- [ ] **Step 4:** 测试通过（5 passed）
- [ ] **Step 5: Commit** `feat(seals): pickSeal 发放规则——常驻均匀 + 季节窗必得/50%`

### Task 3: Supabase 读写（seals.ts 追加）

**Files:**
- Modify: `src/lib/seals.ts`

- [ ] **Step 1: 追加读写**（无单测——薄封装，e2e 冒烟覆盖；风格同 lib/db.ts）

```ts
import { supabase } from './supabase';   // 文件顶部

export interface SealRecord {
  seal_id: string;
  first_earned_at: string;
  first_store: string;
  first_item_count: number;
  times_earned: number;
}

export async function getSealCollection(accountId: string): Promise<SealRecord[]> {
  const { data, error } = await supabase
    .from('seal_collection')
    .select('seal_id, first_earned_at, first_store, first_item_count, times_earned')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data ?? []) as SealRecord[];
}

/** 钤一枚：已有则 times+1（首钤三件套不动——回忆永远是第一次），否则插入。 */
export async function awardSeal(
  accountId: string, sealId: string, store: string, itemCount: number
): Promise<{ record: SealRecord; isFirst: boolean }> {
  const { data: existing } = await supabase
    .from('seal_collection')
    .select('times_earned').eq('account_id', accountId).eq('seal_id', sealId).maybeSingle();
  if (existing) {
    const { data, error } = await supabase
      .from('seal_collection')
      .update({ times_earned: existing.times_earned + 1 })
      .eq('account_id', accountId).eq('seal_id', sealId)
      .select().single();
    if (error) throw error;
    return { record: data as SealRecord, isFirst: false };
  }
  const { data, error } = await supabase
    .from('seal_collection')
    .insert({ account_id: accountId, seal_id: sealId, first_store: store, first_item_count: itemCount })
    .select().single();
  if (error) throw error;
  return { record: data as SealRecord, isFirst: true };
}
```

- [ ] **Step 2:** `npm run typecheck` 干净 → Commit `feat(seals): 集章读写——首钤三件套只写一次`

### Task 4: SealImprint 印记组件（TDD）

**Files:**
- Create: `src/components/SealImprint.tsx`
- Test: `src/components/__tests__/SealImprint.test.tsx`

- [ ] **Step 1: 失败测试**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SealImprint } from '@/components/SealImprint';

describe('SealImprint', () => {
  it('用花图作 CSS mask、印泥朱红打底', () => {
    const { container } = render(<SealImprint sealId="gui" size={64} />);
    const ink = container.querySelector('[data-seal-ink]') as HTMLElement;
    expect(ink.style.maskImage || ink.style.webkitMaskImage).toContain('/flora/gui.webp');
    expect(ink.style.background).toBe('rgb(176, 68, 44)');   // #B0442C
  });
  it('未拥有态渲染虚线空印框、无印泥', () => {
    const { container } = render(<SealImprint sealId="mei" size={64} empty />);
    expect(container.querySelector('[data-seal-ink]')).toBeNull();
  });
});
```

- [ ] **Step 2:** FAIL 确认 → **Step 3: 实现**

```tsx
// 朱红印记：现有 flora webp 经 CSS mask 转剪影 + 圆角方印框 + 斑驳（v1 示意；篆刻风资产 v2 换皮）
interface Props { sealId: string; size: number; empty?: boolean; rotate?: number; }

export function SealImprint({ sealId, size, empty = false, rotate = -6 }: Props) {
  const frame: React.CSSProperties = {
    width: size, height: size, borderRadius: size * 0.18,
    border: empty ? '2px dashed #d8ccb6' : '2.5px solid #B0442C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: `rotate(${rotate}deg)`, background: empty ? 'transparent' : 'rgba(176,68,44,0.06)',
    flexShrink: 0,
  };
  if (empty) return <div style={frame} />;
  const url = `url(/flora/${sealId}.webp)`;
  return (
    <div style={frame}>
      <div
        data-seal-ink
        style={{
          width: size * 0.72, height: size * 0.72,
          background: '#B0442C',
          maskImage: url, WebkitMaskImage: url,
          maskSize: 'contain', WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center', WebkitMaskPosition: 'center',
          opacity: 0.92,   // 印泥微透 = 斑驳示意
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4:** 通过 → Commit `feat(seals): SealImprint——flora mask 转朱红印记，零新资产`

### Task 5: 钤印揭晓接 ShoppingEndModal + 触觉

**Files:**
- Modify: `src/components/ShoppingEndModal.tsx`（saveAndClose 成功分支后插入 'stamp' 视图态）
- Modify: `package.json`（`npm i @capacitor/haptics && npx cap sync`）
- Modify: `src/locales/{zh-CN,zh-TW,en}.json`（`seals.*` 节，见 Task 6 键表）

- [ ] **Step 1: 装依赖** `cd /c/dev/MaiSha && npm i @capacitor/haptics && npx cap sync`
- [ ] **Step 2: 改造 saveAndClose**——保存/埋点成功后不立即 `onDone()`，先发章：

```tsx
// 新增 state
const [earned, setEarned] = useState<{ sealId: string; isFirst: boolean; times: number } | null>(null);

// saveAndClose 成功分支（track 之后）替换 `setAmountStr(''); onDone();` 为：
try {
  const account = getCachedAccount();
  if (account) {
    const owned = new Set((await getSealCollection(account.id)).map(r => r.seal_id));
    const sealId = pickSeal(owned, new Date());
    const { record, isFirst } = await awardSeal(account.id, sealId, supermarketName, snapshot.filter(s => s.checked).length);
    setEarned({ sealId, isFirst, times: record.times_earned });
    setAmountStr('');
    try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* web 降级 */ }
    return;  // 停在 stamp 视图，onDone 交给揭晓页按钮
  }
} catch { /* 发章失败：宁缺毋滥，直接走完成 */ }
setAmountStr('');
onDone();
```

- [ ] **Step 3: 渲染 stamp 视图**（`if (earned)` 优先于原内容返回）——印章压下动画 + 揭晓 + 双按钮：

```tsx
if (earned) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(40,30,20,.5)', zIndex: 1000 }}>
      <div className="mx-6 w-full max-w-xs rounded-3xl p-6 text-center" style={{ background: 'linear-gradient(180deg,#faf6f0,#f3ede4)', border: '1px solid rgba(215,205,188,.5)' }}>
        <style>{`
          @keyframes sealDrop { 0%{opacity:0;transform:translateY(-110px) scale(2) rotate(-20deg)} 55%{opacity:1;transform:translateY(0) scale(.92) rotate(-3deg)} 70%{transform:scale(1.06) rotate(-8deg)} 100%{transform:scale(1) rotate(-6deg)} }
          @keyframes sealFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <div style={{ animation: 'sealDrop 1s cubic-bezier(.22,.68,.28,1) forwards', display: 'inline-block' }}>
          <SealImprint sealId={earned.sealId} size={120} />
        </div>
        <div style={{ opacity: 0, animation: 'sealFade .5s ease-out .9s forwards' }}>
          <div className="mt-3 text-sm" style={{ color: '#7a6e58' }}>{t('seals.earned')}</div>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 26, color: '#5a4e3c' }}>{t(`seals.name.${earned.sealId}`)}</div>
          <div className="text-xs" style={{ color: '#b0a48d' }}>{earned.isFirst ? t('seals.firstTime') : t('seals.timesEarned', { count: earned.times })}</div>
          <div className="flex gap-2 mt-5">
            <button className="flex-1 h-11 rounded-xl text-white text-sm" style={{ background: '#7ca982' }}
              onClick={() => { setEarned(null); onDone(); nav('/seals'); }}>{t('seals.toBook')}</button>
            <button className="flex-1 h-11 rounded-xl text-sm" style={{ background: '#f0e7d8', color: '#7a6e58' }}
              onClick={() => { setEarned(null); onDone(); }}>{t('common.ok')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

（imports：`useNavigate`、`useTranslation`、`getCachedAccount`、`pickSeal/getSealCollection/awardSeal`、`SealImprint`；现有组件未用 i18n/nav，需引入两个 hook。）

- [ ] **Step 4:** `npm test && npm run typecheck` 全绿（既有 ShoppingEndModal 无测试，回归即可）
- [ ] **Step 5: Commit** `feat(seals): 完成采购钤印揭晓——先落库再演出，失败宁缺毋滥`

### Task 6: 集章本页 /seals + 抽屉入口 + i18n

**Files:**
- Create: `src/routes/SealBook.tsx`
- Modify: `src/App.tsx`（`<Route path="/seals" element={<SealBook />} />` 进 AuthedApp 组）
- Modify: `src/components/SettingsDrawer.tsx`（menu：`{ label: t('settings.sealBook'), action: () => nav('/seals') }`，插在图标库之后）
- Modify: 三语 locale

**i18n 键表**（三语齐；zh-TW 繁体、en 意译）：`settings.sealBook` 集章本；`seals.title` 集章本；`seals.progress` 已集 {{n}} / {{total}}；`seals.earned` 钤下一枚；`seals.firstTime` 第一次得到 · 今天；`seals.timesEarned` 共钤 ×{{count}}；`seals.toBook` 贴进集章本 →；`seals.firstMemory` {{date}} · 在{{store}}买了 {{count}} 样；`seals.locked.shuixian/he/gui/mei` 春/夏/秋/冬 · 到季开钤；`seals.name.*` 12 花名。

- [ ] **Step 1: SealBook 实现**（网格 + stagger + count-up + card-flip；花名册顺序 = 4 季节 + 8 常驻）

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCachedAccount } from '@/lib/active-list';
import { getSealCollection, RESIDENT_SEALS, SEASONAL_SEALS, type SealRecord } from '@/lib/seals';
import { SealImprint } from '@/components/SealImprint';
import { formatDate } from '@/utils/date-format';

const ALL_SEALS = [...SEASONAL_SEALS.map(s => s.id), ...RESIDENT_SEALS];

export default function SealBook() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [records, setRecords] = useState<Map<string, SealRecord>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [shown, setShown] = useState(0);          // count-up
  const earnedCount = records.size;

  useEffect(() => {
    const account = getCachedAccount();
    if (!account) { setLoaded(true); return; }
    getSealCollection(account.id)
      .then(rs => setRecords(new Map(rs.map(r => [r.seal_id, r]))))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {                                // 数字滚动：0 → earnedCount
    if (!loaded) return;
    let i = 0;
    const timer = setInterval(() => { i++; setShown(Math.min(i, earnedCount)); if (i >= earnedCount) clearInterval(timer); }, 80);
    return () => clearInterval(timer);
  }, [loaded, earnedCount]);

  return (
    <div className="min-h-screen px-5 pt-5 pb-10" style={{ background: 'var(--paper)' }}>
      <div className="flex items-center mb-1">
        <button onClick={() => nav(-1)} className="text-2xl mr-2" style={{ color: 'var(--ink-light)', background: 'none', border: 'none' }}>‹</button>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 24, color: 'var(--ink)' }}>{t('seals.title')}</span>
      </div>
      <div className="text-sm mb-5" style={{ color: 'var(--ink-light)' }}>{t('seals.progress', { n: shown, total: ALL_SEALS.length })}</div>
      <div className="grid grid-cols-3 gap-4">
        {ALL_SEALS.map((id, idx) => {
          const rec = records.get(id);
          const isFlipped = flipped === id;
          return (
            <div key={id} style={{ perspective: 600, opacity: loaded ? 1 : 0, transition: 'opacity .4s', transitionDelay: `${idx * 50}ms` }}
              onClick={() => rec && setFlipped(isFlipped ? null : id)}>
              <div style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform .5s', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div className="flex flex-col items-center gap-1 p-3 rounded-2xl" style={{ background: '#fffdf7', border: '1px solid #ece3d2', backfaceVisibility: 'hidden' }}>
                  <SealImprint sealId={id} size={64} empty={!rec} rotate={rec ? -6 : 0} />
                  <span className="text-xs" style={{ color: rec ? 'var(--ink)' : 'var(--ink-faint)' }}>{t(`seals.name.${id}`)}</span>
                  {rec && rec.times_earned > 1 && <span className="text-[10px]" style={{ color: '#B0442C' }}>×{rec.times_earned}</span>}
                  {!rec && SEASONAL_SEALS.some(s => s.id === id) && <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>{t(`seals.locked.${id}`)}</span>}
                </div>
                {rec && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 rounded-2xl text-center"
                    style={{ background: '#f6efe3', border: '1px solid #ece3d2', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--ink)' }}>
                      {t('seals.firstMemory', { date: formatDate(rec.first_earned_at), store: rec.first_store, count: rec.first_item_count })}
                    </span>
                    <span className="text-[10px]" style={{ color: '#B0442C' }}>×{rec.times_earned}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

（`formatDate` 若 utils/date-format 签名不符，执行时以实际导出为准替换。）

- [ ] **Step 2:** 路由 + 抽屉入口 + 三语 locale 落键
- [ ] **Step 3:** `npm test && npm run typecheck` 全绿 → Commit `feat(seals): 集章本 /seals——stagger 点亮 + 数字滚动 + card-flip 首钤回忆`

### Task 7: e2e 冒烟 + 收尾

- [ ] **Step 1:** preview（launch.json dev）：完成一次采购 → 揭晓动画出现、印记朱红、文案正确 → 「贴进集章本」跳 /seals → 新印记在格中、翻面见首钤三件套；再完成一次采购（可能得同章 ×2 或新章）→ 翻面首钤信息**不变**；抽屉入口可达；零 console 错误
- [ ] **Step 2:** 无 account 边缘：清 localStorage 匿名新身份未建 account 前完成采购 → 不发章不报错（代码走 catch/无 account 分支）
- [ ] **Step 3:** `npm run build` 干净；ROADMAP「进行中」条目更新为已上线记录；`git push` 并验证 GitHub 落地
- [ ] **Step 4:** memory 更新（collectibles → SHIPPED 状态）

## Self-Review

- spec 覆盖：§2 表/RLS=Task1；§3 发放=Task2；存储读写=Task3；§4 印记/揭晓/触觉=Task4/5；集章本三动效+翻面+锁定预告=Task6；§7 验收 1-6 = Task1/2/7；无 account 边缘=Task5 分支+Task7 冒烟 ✓
- 类型一致：RESIDENT_SEALS/SEASONAL_SEALS/pickSeal/awardSeal/getSealCollection/SealRecord/SealImprint 各任务引用同名同签名 ✓
- 无占位符 ✓；埋点不新增（spec §5）✓
