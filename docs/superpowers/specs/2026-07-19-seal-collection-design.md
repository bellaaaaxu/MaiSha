# 收藏系统「钤印集章」— Design Spec

**Date:** 2026-07-19
**Status:** Approved（方向 2026-07-08 brainstorm + 盖章/集章本 mockup 用户确认；本 spec 落定当时未决的归属/发放/存储三点）

## 0. 背景与定位

梅兰竹菊 12 花从「长尾图标兜底」退役（长尾改纯色块，另一工作流），**转为完成采购的收藏奖励**——呼应文人钤印/朱印集章文化。设计总纲见 [project-design.md](../../project-design.md) §8.7。

**为什么做**：留存是生死线（§9），完成采购（`complete_trip`）恰是北极星指标——把收藏的领取动作钉在北极星行为上，仪式感与留存目标直接咬合。**仪式感四要素**贯穿设计：① 悬念→揭晓（随机）② 不可逆痕迹（钤下的印记永久留在集章本）③ 稀缺限定（季节印）④ 身体锚点（iOS 触觉）。

**集章本的灵魂是回忆，不是积分**：每枚印记翻面是「首钤那天买了什么」——它是买菜编年史，归属感来源。

## 1. 核心闭环

```
完成采购（ShoppingEndModal，≥1 件已购）
  → 客户端按规则定一枚 seal → 写 Supabase（先落库再演出，防演了没存上）
  → 钤印动画：印章压下 → 顿 → 抬起 → 留朱红印记（真机 Haptics.impact medium 一下）
  → 揭晓：「钤下一枚 · 桂」（+ 首次/×N 次标注）
  → 按钮「贴进集章本 →」/「完成」
  → 集章本页：12 格印谱，已钤=朱红印记、未钤=虚线空印框；进入时错落点亮 + 「已集 N/12」数字滚动
  → 点任一已钤印记 → card-flip 翻面：首钤日 · 那天买了 N 样 · 哪家店 · 共钤 ×N
  → 空格 = 回访召唤
```

## 2. 归属与数据模型（本 spec 定案）

**归属：account 级个人集章本。** 理由：① 章奖励的是**完成采购这个动作的人**——激励对准真正去买菜的家庭成员，这正是留存钩子该瞄的人；② accounts 表（migration 009）已有恢复锚点与 RLS，零新概念；③ 挂 list 会随多清单碎片化、随清单归档丢历史。家人互看集章本 = Non-goal（将来可做「晒章」）。

**migration 015_seal_collection.sql：**

```sql
CREATE TABLE seal_collection (
  account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seal_id        TEXT NOT NULL,          -- flora 成员 id（mei/lan/…），永不改名（沿袭单向门）
  first_earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_store    TEXT NOT NULL DEFAULT '',   -- 首钤回忆三件套
  first_item_count INT NOT NULL DEFAULT 0,
  times_earned   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (account_id, seal_id)
);
ALTER TABLE seal_collection ENABLE ROW LEVEL SECURITY;
-- SELECT/INSERT/UPDATE 均限 auth.uid() = ANY(accounts.member_uids)；无 DELETE（印记不可逆）
```

- 一行 = 一种章；重复获得 `times_earned + 1`（重复不是空刀，卡面显示 ×N）。首钤三件套只写一次，翻面回忆永远是「第一次」——初见最珍贵，也免去 per-event 日志表（YAGNI）。
- 写入走客户端 upsert（`onConflict: account_id,seal_id` → increment）。反作弊非目标：个人愉悦系统无经济，刷 1 件商品的「采购」刷章不值得防。
- **无 account（极端边缘：账号建失败的孤儿会话）**：跳过发章，静默不挡完成采购流程。

## 3. 发放规则（本 spec 定案）

**池子 = 现有 12 花，8 常驻 + 4 季节限定：**

| 组 | 成员 | 规则 |
|---|---|---|
| 常驻 8 | 兰、竹、菊、松、银杏、枫、紫藤、芦苇 | 每次完成采购（≥1 件已购）随机 1 枚，均匀分布 |
| 季节限定 4 | **水仙**（立春窗 02-01~03-15）· **荷**（盛夏窗 06-15~08-15）· **桂**（中秋窗 09-01~10-15）· **梅**（隆冬窗 12-01~01-31） | 窗口内完成采购：**未拥有该季印 → 必得**；已拥有 → times+1 与随机常驻**二选一（50%）**，兼顾「窗口内仍有惊喜」与「重复也有意义」 |

- 窗口用固定月日近似节气（跨年窗「梅」注意 12→1 月跨界判断），精确节气历法 = Non-goal。
- 发放纯客户端逻辑（`pickSeal(collection, now)` 纯函数，可单测：窗口命中/跨年/已拥有分支/均匀性）。

## 4. UI 与动效

**① 钤印揭晓（ShoppingEndModal 内，采购保存成功后）**
- 复用已确认的 mockup 节奏（scratchpad `gen-seal-mockup.mjs`）：~1s 压下-顿-抬起，留印带 -6° 随手感，光晕一圈扩散，文字「钤下一枚 · 桂花」淡入。
- 真机触觉：`@capacitor/haptics`（**新依赖**，需 `cap sync`；web 端 no-op 降级）。
- 失败降级：Supabase 写入失败 → 不演出、不提示（下次采购再来，宁缺毋滥假奖励）；动画资源缺失 → 直接文字揭晓。

**② 集章本页（新路由 `/seals`，入口 = 设置抽屉「集章本」+ 揭晓页按钮）**
- 12 格印谱网格；已钤 = 朱红印记 + 花名；未钤 = 虚线空印框 + 灰名（季节印额外标注窗口，如「冬 · 立冬开钤」——预告即钩子）。
- 进入动效：格子错落点亮（stagger ~50ms/格）+「已集 N / 12」数字滚动（count-up）。
- **card-flip 翻面**：点已钤印记 → 3D 翻转看背面：首钤日期 · 「那天买了 N 样 · {店名}」 · 共钤 ×N。点空印记 → 轻微晃动（未解锁反馈）。
- 动效红线（§8.7 调研结论）：只用 flip/stagger/count-up 三件，不引任何动效库；背景粒子/玻璃拟态等网站脸一律不碰。

**③ 印记视觉 v1**
- 现有 `public/flora/*.webp` 经 **CSS `mask-image`** 转朱红（`#B0442C`）剪影 + 圆角方印框 + 轻微斑驳（CSS 纹理/透明度扰动示意）。零新资产、零 precache 增量。
- Gemini 真「篆刻刀刻」风资产 = v2（Non-goal），届时只换图不换逻辑。

## 5. 接线与 i18n

- 触发点：[ShoppingEndModal.tsx](../../../src/components/ShoppingEndModal.tsx)（`complete_trip` 埋点同处，L60 附近）；获取 account 用现有 `getCachedAccount()`。
- 新文件：`src/lib/seals.ts`（pickSeal 纯函数 + upsert）、`src/routes/SealBook.tsx`、`src/components/SealImprint.tsx`（mask 印记，揭晓与集章本复用）。
- i18n 三语新节 `seals.*`（花名沿用 decor 语义：梅/兰/竹/菊…英文 Plum/Orchid/Bamboo/Chrysanthemum…）。
- 埋点：**不加新事件**（analytics spec Non-goals「不埋五个事件以外的」仍有效；集章行为可由 seal_collection 表本身查询）。

## 6. Non-goals

- 家庭共享/互看集章本（将来「晒章」另议）
- Gemini 篆刻风印章资产（v2 换皮）
- 精确节气历法、24 节气全覆盖（固定月日窗近似，4 枚起步）
- 小榕包 C 位特殊章 / 食物小人图鉴层（另一套资产线，宪法 §8.3 保留）
- 印章分享图、成就通知、push
- 反作弊 / 服务端裁决 RPC
- 集章本动效之外的任何动效库引入

## 7. 验收

1. migration 015 应用；RLS：非成员读不到、写不进；无 DELETE 策略。
2. `pickSeal` 单测 ≥6：常驻均匀、窗口必得、窗口已拥有 50/50 分支、跨年梅窗（12 月与 1 月都命中）、空 collection、≥1 件已购门槛在调用侧。
3. 完成采购 e2e：揭晓动画 → `/seals` 见新印记；重复获得显示 ×N；翻面显示首钤三件套且**不因再次获得而改变**。
4. 无 account 会话完成采购：不发章、不报错、采购流程完好。
5. web 无触觉环境零 console 错误；179 基线测试不回归。
6. ROADMAP 同 session 更新。
