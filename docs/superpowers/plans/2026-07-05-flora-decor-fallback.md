# 梅兰竹菊装饰系换装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 长尾兜底从食物小人换装为「梅兰竹菊装饰系（12 只无脸花卉）+ 首字角标」，小人退役出商品图标层。

**Architecture:** spec 见 [2026-07-05-flora-decor-fallback-design.md](../specs/2026-07-05-flora-decor-fallback-design.md)。渲染层纯换装（无 DB 变更）：decor-registry（rendezvous 引擎改名迁移，12 花等权重）+ DecorFallback（裸花图 + 首字纸片角标，onError 回退 WatercolorFallback）+ 6 调用点接线；MascotFallback/mascot-registry 删除，public/mascots 移出。资产走既有管线：API 批量出图（8 新 + 兰重生成）→ 筛选（无脸 + 撞形判定）→ 自适应抠底压缩 → public/flora/。

**Tech Stack:** 同班底最小版（React18+TS、Vitest、sharp、gemini-3-pro-image）。纯 Windows 可完成。

**执行顺序**：Task 1 先点火（出图后台跑 ~5 分钟），Task 2–5 代码并行推进，Task 6 起消费出图结果。

---

### Task 1: 出图点火（后台）

**Files:**
- Create: `scripts/generate-flora.mjs`（试装脚本正式化：12 花全名册 + 无脸约束 + 风格块一字不改；`--only` 支持）

- [ ] **Step 1:** 写脚本——roster 用 spec §1 角色行；兰重生成角色行改「两三片细长弯叶，开两朵**大而清晰**的淡紫白色兰花（花为主角、叶少而疏）」；输出 `mascot-staging/flora-generated/<id>__v<n>.png` + contact sheet（44px/28px 预览）
- [ ] **Step 2:** 后台跑 `node --env-file=.env scripts/generate-flora.mjs --only song,he,gui,yinxing,feng,shuixian,ziteng,luwei,lan`（9 只 × 3 = 27 张）；跑的同时推进 Task 2

### Task 2: decor-registry（TDD）

**Files:**
- Create: `src/utils/decor-registry.ts`
- Test: `src/utils/__tests__/decor-registry.test.ts`

- [ ] **Step 1: 失败测试**（由 mascot-registry.test.ts 迁移改造）

```ts
import { describe, it, expect } from 'vitest';
import { DECOR_MEMBERS, assignDecor, decorUrl, type DecorMember } from '@/utils/decor-registry';

describe('decor-registry', () => {
  it('同一商品名永远同一张贴纸（稳定）', () => {
    expect(assignDecor('老干妈辣酱').id).toBe(assignDecor('老干妈辣酱').id);
  });
  it('繁简归一到同一张贴纸', () => {
    expect(assignDecor('雞蛋餅').id).toBe(assignDecor('鸡蛋饼').id);
  });
  it('花名册 12 只且等权重', () => {
    expect(DECOR_MEMBERS).toHaveLength(12);
    expect(DECOR_MEMBERS.every(m => m.weight === 1)).toBe(true);
  });
  it('扩池不洗牌：加新成员后老名字要么原贴纸要么归新成员', () => {
    const names = Array.from({ length: 200 }, (_, i) => `商品${i}号`);
    const before = new Map(names.map(n => [n, assignDecor(n).id]));
    const grown: DecorMember[] = [...DECOR_MEMBERS, { id: 'shanchahua', file: 'shanchahua', name: '山茶', weight: 1 }];
    for (const n of names) expect([before.get(n), 'shanchahua']).toContain(assignDecor(n, grown).id);
  });
  it('等权重分布大致均匀（每只 ≈ 1/12）', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const id = assignDecor(`item-${i}-测试`).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const m of DECOR_MEMBERS) {
      const c = counts.get(m.id) ?? 0;
      expect(c).toBeGreaterThan(150);
      expect(c).toBeLessThan(400);
    }
  });
  it('decorUrl 指向 public/flora', () => {
    expect(decorUrl(DECOR_MEMBERS[0])).toMatch(/^\/flora\/.+\.webp$/);
  });
});
```

- [ ] **Step 2:** 跑测试确认失败（模块不存在）
- [ ] **Step 3: 实现**——mascot-registry.ts 复制改造：`DECOR_MEMBERS` = spec §1 十二花（id/file/name/weight 全 1，id 永不改名注释保留）；fnv1a+fmix32 原样（终混教训注释保留）；`assignDecor`/`decorUrl`
- [ ] **Step 4:** 测试通过（6 passed）
- [ ] **Step 5:** Commit `feat(flora): decor-registry——12 花等权重 rendezvous，扩池不洗牌`

### Task 3: getMonogram（TDD）

**Files:**
- Modify: `src/utils/image-utils.ts`
- Test: `src/utils/__tests__/image-utils.test.ts`（若无则建）

- [ ] **Step 1: 失败测试**

```ts
it('getMonogram：中文取首字', () => expect(getMonogram('老干妈辣酱')).toBe('老'));
it('getMonogram：拉丁取首字母大写', () => expect(getMonogram('shampoo')).toBe('S'));
it('getMonogram：空串返回 ·', () => expect(getMonogram('  ')).toBe('·'));
```

- [ ] **Step 2: 实现**

```ts
export function getMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  const first = Array.from(trimmed)[0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}
```

- [ ] **Step 3:** 通过后 Commit `feat(flora): getMonogram 首字角标字符`

### Task 4: DecorFallback 组件（TDD）

**Files:**
- Create: `src/components/DecorFallback.tsx`
- Test: `src/components/__tests__/DecorFallback.test.tsx`

- [ ] **Step 1: 失败测试**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecorFallback } from '@/components/DecorFallback';
import { assignDecor, decorUrl } from '@/utils/decor-registry';

describe('DecorFallback', () => {
  it('渲染按商品名分配的花贴纸', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    const img = screen.getByRole('presentation') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(decorUrl(assignDecor('老干妈辣酱')));
  });
  it('渲染首字角标', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    expect(screen.getByText('老')).toBeInTheDocument();
  });
  it('英文商品角标取首字母大写', () => {
    render(<DecorFallback name="shampoo" category="其他" />);
    expect(screen.getByText('S')).toBeInTheDocument();
  });
  it('花图加载失败回退水彩文字 blob', () => {
    render(<DecorFallback name="老干妈辣酱" category="调料" />);
    fireEvent.error(screen.getByRole('presentation'));
    expect(screen.queryByRole('presentation')).toBeNull();
    expect(screen.getByText('老干')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现**（无晕染底、无 lazy、角标纸片）

```tsx
// Tier 2/3 长尾兜底：梅兰竹菊装饰 + 首字角标（design §8.2，2026-07-05 换装）。
// 装饰不声称品类；识别靠角标首字。花图缺失/加载失败回退水彩文字 blob。
import { useState } from 'react';
import { assignDecor, decorUrl } from '@/utils/decor-registry';
import { WatercolorFallback } from '@/components/WatercolorFallback';
import { getMonogram } from '@/utils/image-utils';

interface Props {
  name: string;
  category: string;
  size?: number;
}

export function DecorFallback({ name, category, size = 48 }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <WatercolorFallback name={name} category={category} size={size} />;
  }
  const member = assignDecor(name);
  const badge = Math.round(size * 0.42);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img
        src={decorUrl(member)}
        alt=""
        role="presentation"
        width={Math.round(size * 0.94)}
        height={Math.round(size * 0.94)}
        onError={() => setFailed(true)}
        style={{
          objectFit: 'contain',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: badge,
          height: badge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fffdf7',
          border: '1px solid #d5cbbe',
          borderRadius: '30%',
          transform: 'rotate(-6deg)',
          fontFamily: "'ZCOOL KuaiLe', cursive",
          fontSize: badge * 0.62,
          color: '#4a4540',
          lineHeight: 1,
        }}
      >
        {getMonogram(name)}
      </span>
    </div>
  );
}
```

- [ ] **Step 3:** 通过后 Commit `feat(flora): DecorFallback——裸花图+首字纸片角标，失败回退文字`

### Task 5: 接线换装 + 小人代码退役

**Files:**
- Modify: ItemRow / ItemGrid / ShoppingMode / StoreFinder / AddSheet / IconPickerPanel（`MascotFallback` → `DecorFallback`，sed 全局替换同前次）
- Delete: `src/components/MascotFallback.tsx`、`src/components/__tests__/MascotFallback.test.tsx`、`src/utils/mascot-registry.ts`、`src/utils/__tests__/mascot-registry.test.ts`

- [ ] **Step 1:** 替换 + 删除
- [ ] **Step 2:** `npm test && npm run typecheck` 全绿（159 基线 − 7 小人 + 13 花 = 165±）
- [ ] **Step 3:** Commit `feat(flora): 6 调用点换装 DecorFallback，小人代码退役`

### Task 6: 筛图定稿

- [ ] **Step 1:** Read 逐张审 27 张（无脸合规 + 44px 撞形判定 + 同手水彩），每只选 1 → `mascot-staging/flora-final/<id>.png`
- [ ] **Step 2:** 试装批定稿 3 只直接拷入：`trial-mlzj/mei__v1.png → flora-final/mei.png`、`zhu__v1 → zhu`、`ju__v3 → ju`；兰用重生成批的中选张（若仍不及格回退 trial lan__v1）
- [ ] **Step 3:** 12 只 contact sheet 复验「任意两只 44px 一眼可辨」，标注定稿开给用户过目（异步，不阻塞）

### Task 7: 压缩入库 + 小人资产退役

**Files:**
- Create: `scripts/compress-flora.mjs`（抄 compress-mascots.mjs：flora-final → public/flora，自适应抠底 + 256² q85）
- Delete: `public/mascots/`（11 张退出 precache；compress-mascots.mjs/generate-mascots.mjs 保留备图鉴）

- [ ] **Step 1:** 跑压缩，12 张 ≤150KB
- [ ] **Step 2:** `git rm -r public/mascots`
- [ ] **Step 3:** `npm run build`——manifest 含 flora、无 mascots 残留
- [ ] **Step 4:** Commit `feat(flora): 12 花资产入库 + 小人资产退役出 precache`

### Task 8: preview 冒烟 + 收尾

- [ ] **Step 1:** 长尾商品见「花 + 首字角标」；同名同花；预设/自定义优先级不破坏；隐藏标签页图片正常加载；截图留证
- [ ] **Step 2:** 撞图抽查：两件同花商品靠角标可区分
- [ ] **Step 3:** ROADMAP（进行中 → 已上线，弊端两条关闭）+ memory 同步 + push

## Self-Review

- spec §1–§4 全覆盖（名册/组件/管线/退役 = Task 2/3/4+5/1+6+7）；§5 文档同步已提前落地（spec commit），Task 8 只剩状态推进
- 类型一致性：DecorMember/assignDecor/decorUrl 贯穿 Task 2/4；getMonogram 贯穿 Task 3/4
- 无占位符；所有命令与预期输出明确
