# 账号图标库（Account-Scoped Icon Library）设计

> 状态：已复审定稿　|　日期：2026-05-31 初稿 · 2026-06-02 复审　|　关联：[[project_multi_list_idea]]、自定义图标设计（2026-05-19）、数据持久化找回设计（2026-05-28）

## 复审记录（2026-06-02）

本次复审在不改变总体方向的前提下，锁定/调整了 6 处：

1. **v1 范围拆分**：schema 一次迁到位（010 同时建 `icon_library` + `list_icon_assignments`，趁 pre-launch 迁移最便宜），但 UX 分两批——v1 只上**地基**（账号库 + 并集 RPC + repoint readers），**复用选择器 + 图标库打磨**降为**纯前端 fast-follow（v1.1，无需二次迁移）**。
2. **同名并集 tie-break 改 `created_at` 最早（先画者占名）**：替代原「`updated_at` 最新者胜」，避免编辑/重生成自己的图把争议名在全家视图里翻掉；保持「全家看同一张」的确定性，不引入 per-viewer self-priority。
3. **迁移去重对齐 runtime**：撞 `(account_id,name)` 时保留 **`created_at` 最早**那张（与第 2 条一致，非 updated_at）；每删一行写日志；apply 010 前先跑只读审计（三个计数）。
4. **AI 防刷改软门槛 graduated**：替代「新/空号一律不能生成」的硬门槛——成熟前可先画 2 张（保零注册首用），成熟度=账号 ≥3 件物品 或 年龄 ≥1h，之后 5/账号/天；全局 100/天 + 记 ip/uid/account 告警照旧；每 IP 硬限不开（NAT 风险）。
5. **简繁归一化**：确认纳入 v1（一张手维护小词表，不引重依赖）。
6. **家人新图实时同步**：确认推迟到 **v2**（v1 接受刷新/重开才见）。

## 概述

把自定义图标从「绑清单（`list_id`）」升级为「绑账号（`account_id`）」，让图标**跟着人走**：跨设备、跨清单都不丢、可复用。共享清单上，渲染时取**所有清单成员个人库的并集**（合集模式），因此现有「家人/朋友能看到彼此图标」的体验**完全保留**。新增一层稀疏的「清单指派」表，支撑「用 A 的图给名字 B 的物品」这类显式复用，以及同名冲突的精确解决。

核心收益：
1. 换设备 / 未来多清单不再重建图标。
2. 全家/好友任一人画过的同名图标，其他人自动复用 → **被动降低 AI 生成成本**。
3. 加物品时可从「我的图标库」直接挑现成图标复用。

## 背景与现状

- 现有 `custom_icons` 按 `(list_id, name)` 唯一，存于 public 桶 `custom-icons/{list_id}/{icon_id}.webp`，RLS 限清单成员读写（`003_custom_icons.sql`）。
- 物品**没有图标字段**：渲染纯按 `item.name` 匹配，经 `resolveIconUrl(name, Map<name,url>)`，顺序「自定义 → 预设 → 水彩兜底」（`src/utils/icon-registry.ts`）。这张 `Map<名字,URL>` 一路透传到 List / StoreCard / ItemRow / AddSheet。
- 账号实体已存在：`accounts(recovery_code, member_uids)`，`lists.account_id` 指向账号（`009_accounts.sql`）。两条加入路径：**加入清单**（6 位短码，只进 `lists.member_uids`，仍是各自的账号）；**找回**（8 位找回码，进账号及名下所有清单）。
- 代码里**没有"移除成员/退出清单"**：成员只增不减、账号永久 → 合集模式不存在"作者离开后图标消失"的问题。
- AI 生成经 Edge Function `generate-icon`，限额每人 5/天 + 全局 100/天 + Google 预算硬顶。

## 设计决策汇总（已确认）

| # | 决策 |
|---|---|
| 1 | 方向：图标按账号存、跟人走 |
| 2 | 共享可见性：**合集**——清单显示所有成员个人库并集 |
| 3 | v1 范围：**schema 一次迁到位（010 建两表）+ 地基 UX（账号库 + 并集 RPC + repoint readers）**；复用选择器 + 图标库打磨为**纯前端 fast-follow（v1.1，无需二次迁移）** |
| 4 | 架构：**两层**——账号 `icon_library` + 稀疏 `list_icon_assignments` |
| 5 | 复用选择器交互：**A 内联缩略图行**（点一下即用，行尾「查看全部 ›」开整页网格） |
| 6 | 图标库管理页：只显示「我的」（账号级、跨清单）+ 预设 |
| 7 | 社交/分享：**本期不做**（纯聚焦，另案） |
| 8 | 同名冲突：清单指派（显式设定）优先；否则并集内 **`created_at` 最早者胜（先画者占名）** |
| 9 | AI 额度：**按账号/天** + 全局 100/天封顶兜底 |
| 10 | 防刷：**软门槛 graduated**——成熟前可先画 2 张（保零注册首用），成熟度=账号 ≥3 件物品 或 年龄 ≥1h，之后 5/账号/天；记录 IP 监控；**每 IP 硬限不开（NAT 误杀风险）**，CAPTCHA 按需再开 |
| 11 | 清单成员软上限 **~10–12 人** |
| 12 | 名字匹配做**简繁归一化**（繁/简、粤语版互通） |

## 数据模型

### 1. `icon_library`（由 `custom_icons` 升级）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK→accounts | **新增**，归属账号（替代 `list_id` 的归属角色） |
| `name` | text | 物品名，匹配键 |
| `image_path` | text | 存储路径，**老文件原地不动**，路径自包含 |
| `source` | text | `upload` / `ai_generated` / `ai_stylized` |
| `created_by` | text | 创建者 uid |
| `created_at`/`updated_at` | timestamptz | |

- 唯一键：`(list_id, name)` → **`(account_id, name)`**。
- 索引：`icon_library(account_id)`。
- 移除 `list_id` 列（路径已含旧 list_id，无需保留该列）。

### 2. `list_icon_assignments`（新增，稀疏）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `list_id` | uuid FK→lists ON DELETE CASCADE | |
| `name` | text | 这张清单上的物品名（如「生抽」） |
| `icon_id` | uuid FK→icon_library ON DELETE CASCADE | 指向库里某张图 |
| `set_by` | text | uid |
| `created_at`/`updated_at` | timestamptz | |

- 唯一键 `(list_id, name)`；索引 `(list_id)`。
- 仅在用户**显式挑选/替换**时写入（绝大多数物品无此行）。
- `icon_id` 级联删除：库里图被删 → 指派自动消失 → 回落到并集/预设/兜底。

### 3. 迁移（migration `010_account_icon_library.sql`）

1. `ALTER TABLE custom_icons RENAME TO icon_library;` 保留数据与存储路径。
2. 加 `account_id`，按下述回填：每行 → `created_by` 所属账号（`accounts.member_uids @> ARRAY[created_by::uuid]`，取最早）；找不到则回退到原 `list_id` 对应的 `lists.account_id`。
3. 处理 `(account_id, name)` 撞键：多清单 UI 未上线、现每账号≈一张清单，撞键几乎不可能；如撞，保留 **`created_at` 最早者**（与解析逻辑的并集 tie-break 一致）、删其余，**每删一行写迁移日志**。
4. 删旧唯一键与 `list_id` 列，建新唯一键 `(account_id, name)` 与索引。
5. 更新存储/表 RLS（见下）。新图写 `custom-icons/{account_id}/{icon_id}.webp`；旧图路径不变，公开 URL 照常解析。
6. 建 `list_icon_assignments` 表及 RLS、索引。

> **迁移前审计（只读）**：apply 010 之前先跑三个计数——`custom_icons` 总行数、潜在 `(account_id, name)` 撞键数、`created_by` 不在任何账号的行数；撞键数 ≈ 0、其余符合预期再迁，把「撞键几乎不可能」这个假设落到实数上。
>
> **兼容性**：目前仅 PWA、单用户（开发者本人），可直接 rename + 干净迁移，无需兼容视图。**上架 iOS/Android 后**客户端无法强制更新，后续 schema 变更应走「扩展→双写→收缩」(expand-contract)——本次先确立这一纪律，迁移本身保持简单。

## 解析逻辑（消费方零改动是关键）

新增 RPC：

```
get_list_icon_map(p_list_id uuid) RETURNS TABLE(name text, image_path text, source text, kind text, created_at timestamptz, updated_at timestamptz)
-- SECURITY DEFINER；先校验 auth.uid() 是 p_list_id 成员
-- 返回两类行：
--   kind='library'    : 该清单所有成员所属账号的 icon_library（并集）
--   kind='assignment' : 该清单的 list_icon_assignments（join icon_library 取 image_path）
```

SQL 要点（务必收窄，勿全局扫）：

```sql
v_members := (SELECT member_uids FROM lists WHERE id = p_list_id);            -- 2~6 个
-- 并集：成员所属账号（数组重叠走 GIN）
accounts := SELECT id FROM accounts WHERE member_uids && v_members;
library  := SELECT name,image_path,source,created_at,updated_at FROM icon_library WHERE account_id IN (accounts);
assigns  := SELECT a.name, il.image_path, il.source, il.created_at, a.updated_at
            FROM list_icon_assignments a JOIN icon_library il ON il.id=a.icon_id
            WHERE a.list_id = p_list_id;
```

客户端 `useCustomIcons(listId)`（保留同名与返回结构 `{ iconMap, icons, refresh }`）改为调此 RPC，并在 JS 里构建 `Map<name,url>`：

```
对 library 行按 created_at 降序 map.set(name, url)   // 先画者占名：created_at 最早者最后写入、生效
对 assignment 行 map.set(name, url)                  // 指派覆盖在最上层
```

最终某物品名 `X` 在某清单的解析顺序：

```
1. 清单指派 (list_id, X)         ← "这张清单最后设定"，最高
2. 成员库并集中名为 X 的图        ← 同名取 created_at 最早（先画者占名）
3. 预设库 (icon-registry)
4. 水彩兜底 (WatercolorFallback)
```

`resolveIconUrl`、`ItemRow`、`StoreCard`、`AddSheet` 等**一行不动**。

> **v1 说明**：`list_icon_assignments` 在 010 已建表、RPC 已读它，但**写入路径（复用选择器 / 替换）属 v1.1**；故 v1 运行时 assignment 行恒为空、实际只有 library 并集（`created_at` 最早占名）生效——解析四层顺序不变，只是第 1 层（指派）暂无人写。

管理页另用 `useMyLibrary(accountId)`：只取 `icon_library WHERE account_id = 我的账号`（增删改查我的图标）。

### 名字匹配：简繁归一化

- 匹配键经 `normalizeName()` 归一（繁→简、去空白）；**展示仍用原始 `name`**。
- 覆盖面：构建并集 Map 的 key、指派/预设查找、并集去重（「椰浆」与「椰漿」、「酱油」与「醬油」视为同名 → 自动合并/复用），照顾繁体与粤语版用户。
- 实现：**纳入 v1 地基**；限定食材/日用词汇，用一张轻量手维护映射表（避免 OpenCC 级重依赖）；具体词表在 plan 阶段定。

## 权限 / RLS

- `icon_library` SELECT：账号成员可读自己的库（管理页）。读图渲染走 public URL，不依赖此策略。
- `icon_library` INSERT/UPDATE/DELETE：`account_id` 属于 `auth.uid()` 所在账号。
- `list_icon_assignments` 读写：清单成员（同 items 模式）。
- 存储桶 `custom-icons`：保持 public 读；新增 INSERT/DELETE 策略允许账号成员写 `{account_id}/*`（旧的 list 文件夹策略保留以兼容旧文件）。
- RPC `get_list_icon_map` 用 SECURITY DEFINER + 入口校验成员资格，绕过逐行 RLS、单次往返。

## 成员与邀请

- **邀请家人 = 清单短码 / 链接**（6 位，`join_by_code`）：加入即成为该清单成员，仍是各自的账号。这是唯一的「邀请他人」路径，朋友/家人通用。
- **8 位账号找回码 ≠ 邀请**：用于「同一个人换设备找回」，会把 uid 并入账号（同一数据身份）；**不应发给家人**。文案上与「邀请家人」严格区分（已在持久化设计中分开）。
- **目前无独立「家庭名册」实体**：成员 = 清单成员。真正的「家庭/household」管理（配合按账号额度展示、多清单）归 [[project_multi_list_idea]]，本期不做。
- **清单成员软上限 ~10–12**：在 `join_by_code` / `claim_account` 加人时校验；超出温和提示「人数已满」。护栏作用（家庭形状 + 约束并集规模），非硬安全边界。
- 文案微调：若朋友/他人是正式场景，隐私政策「仅与家庭成员共享」改为「仅与你主动邀请的人共享」。

## UX

### A. 复用选择器（加物品）— v1.1 fast-follow（纯前端，assignments 表已在 010 备好）

物品名**无预设、且并集里无同名**时，弹「没找到『X』」提示：
- **内联缩略图行**：横向铺「我的图标库」（最近优先），**点一下即用** → 写 `list_icon_assignments(list_id, X, icon_id)` → 物品立刻带图加入。
- 行尾「**查看全部 ›**」→ 打开整页可搜索网格（即图标库页的选择态）。
- 其余按钮：📷 上传 / 🎨 AI 生成 / 先跳过（保持现状）。
- 名字**完全相同**时不弹此提示（并集已自动解析）。

### B. 图标库页升级（`src/routes/IconLibrary.tsx`）

- **（v1，迁移强制）** 数据源从「单清单 `custom_icons`」改为「**我的账号 `icon_library`**」（跨清单）；删除我的图标 → 受影响清单回落到并集/预设/兜底（删除前提示）。
- **（v1.1 fast-follow）** 顶部搜索框、「**用自定义替换预设**」写指派、整页可搜索网格（复用选择器的"查看全部"）。
- 版式沿用现有两节：**我的 · N**（增删改/重生成）、**预设 · N**（可"用自定义替换"）。

### C. 替换与冲突

- **（v1.1 fast-follow）** "用自定义替换预设" / "在这张清单改用某图" → 写 `list_icon_assignments`（钉死这张清单的 `name→icon`），不再覆盖全局库。
- 同名并集冲突无需用户介入：默认 **`created_at` 最早者胜（先画者占名）**；想固定 → 显式设定即生成一条指派（v1.1）。

## 性能与扩展性

- 热路径（勾选物品 / Realtime）**不碰** accounts / icon_library / assignments。
- `get_list_icon_map` 为冷路径（开清单时一次），数据量小（成员 2~6、图标数十）；**必须按清单成员收窄**，配 `accounts.member_uids` 的 **GIN 索引**、`icon_library(account_id)`、`list_icon_assignments(list_id)` 索引。
- 真正并发天花板是 Realtime 连接数（Free≈200 / Pro≈500 可加购），与本功能无关。
- 既有可后续优化点（非本功能引入）：RLS 普遍用 `auth.uid() = ANY(member_uids)`（数组顺扫）；清单数到几万级时改 `member_uids @> ARRAY[auth.uid()]` 并加 GIN。

## AI 额度、成本与防刷

- **复用即降本**：并集按名字复用 → 同名图标全家只生成一次；复用选择器 → 跨名复用。AI 调用与存储**净下降**。
- **额度单位改为「按账号/天」**（原为按 uid/天）。`ai_generation_log` 增列 `account_id`（及 `ip` 供监控）；限额按 `account_id` + 当日计数。一个家庭一份每日预算，人多人少一样，顺手堵掉「加人刷额度」。
- **全局 100/天封顶保留**：成本死封顶（最坏 ~$3–4/天），与家庭规模无关。注意它既是安全阀也是增长瓶颈——上规模时需调高，届时按账号公平性才真正生效。
- **软门槛 graduated（替代硬门槛）**：全新账号**成熟前可先画 2 张**（保住零注册首用 delight），超出才要求成熟度——账号名下 **≥3 件物品** 或 **账号年龄 ≥1 小时**（满一即算，故基本 1 小时后自动成熟），之后走 **5/账号/天**。既挡「建号即刷」的突发脚本，又不挡真实新家庭第一次。
- **监控**：生成时记录 `ip`/`uid`/`account_id`，异常（单 IP 多号、突增）告警。
- **暂不做、按需再开**：匿名登录 CAPTCHA + 限频、每 IP 每日硬限——**每 IP 硬限对中国市场风险高（运营商大规模 NAT，大量真实用户共享出口 IP，按 IP 限会误杀整片真人）**，仅在见到明确滥用或上规模时再启用（Supabase 原生设置 / Edge Function 加 IP 计数）。
- 关联 future work：跨用户高频自建图标 → 人工提拔进预设库（「社区精选转预设」），最划算的集体收益，无公开 UGC 暴露面。

## 边界情况

- **无成员移除** → 并集不会丢图（成员/账号永久）。
- **删库中图** → 指派级联删除，渲染回落；管理页删除前提示影响范围。
- **离线/PWA**：Workbox 对 `custom-icons` 桶的 CacheFirst 规则照旧命中（新旧路径同桶同公开 URL）。
- **Edge Function `generate-icon`**：按调用者 uid 解析 `account_id`、写入 `icon_library`；额度按 `account_id`/天 + **软门槛 graduated**（成熟前 2 张 → 成熟后 5/天）+ 记录 `ip/uid/account_id`；全局 100/天封顶保留（原 `list_id` 入参保留用于成员校验）。

## 不在本期范围

> 「本期」= **v1 地基**。下分两类：**(a) v1.1 fast-follow**（已规划、schema 在 010 已备好，纯前端跟进，不需再迁移）；**(b) 真正另案 / 更后**。

**(a) v1.1 fast-follow（紧接 v1）**

- 复用选择器（AddSheet 内联缩略图 + 点选写 `list_icon_assignments`）+「查看全部」整页网格。
- 图标库页打磨：搜索框、「用自定义替换预设」写指派。

**(b) 另案 / 更后**

- 任何分享/社交（系统分享、单图分享给好友、公开画廊、社交图谱）。
- 图标库页的「家人添加的」浏览/借用节（需先解决"跨清单库里家人指谁"的作用域问题）。
- 多清单 UI 本身（本设计只为它铺好账号级地基）。
- 图标实时同步（家人新图当前需刷新/重开才见）——**推迟到 v2（已定）**。
- 预设/图标库的**批量生成工具**（dev 侧管线）——**另案**，见下「关联工作」。

## 关联工作（另案，非本 spec）

- **批量生成图标管线**：现状是把 `icon-prompts.md` 的 prompt 手工逐条贴进 Gemini → 下载 → `compress-icons.mjs`。可写一个批量驱动脚本（物品清单 → Gemini 文生图 → 压缩 → 落 `public/icons/` + 注册进 `icon-registry`），实现「快速铺量」，**纯文生图、无 IP 风险**。
- **参考图风格化**（照片 → 水彩）：技术上已支持（`ai_stylized`）。但**抓取超市官网图作分发预设有版权/ToS 风险**；高保真需求用自拍/授权素材作参考，且仅限私人，勿提拔为官方预设。与上文「社区精选转预设」配合压低 AI 成本。

## 测试计划

- **单元（JS）**：`Map` 构建的优先级——指派覆盖并集、并集同名取最新、指派>并集>预设>兜底。
- **迁移**：`custom_icons → icon_library` 回填账号正确；撞键保最新；旧 `image_path` 仍可解析。
- **RPC**：成员可拿到并集 + 指派；非成员被拒；按清单成员收窄（无全局扫）。
- **组件**：复用选择器点选写指派、物品即带图；图标库页显示账号级我的图标；删除回落。
- **额度/防刷**：按账号计数正确；同账号多 uid 共享额度；空/新账号被成熟度门槛拒；全局封顶生效；成员软上限超出被拒。
- **回归**：现有 `group-items`、`merge-frequent-items` 等测试不受影响。

## 上线步骤

### v1 — 地基（一个 release）

1. migration `010`：`custom_icons → icon_library`（+ `account_id` + 回填 + 新唯一键），**同时建 `list_icon_assignments` 空表**（趁 pre-launch 一次迁到位）+ RLS + 索引 + `get_list_icon_map` RPC（返回 `created_at` 供 tie-break）；`ai_generation_log` 加 `account_id`/`ip`；`join_by_code`/`claim_account` 加成员软上限。**apply 前先跑只读审计**。
2. Edge Function `generate-icon`：写 `icon_library`、额度按账号/天 + **软门槛 graduated**、记录 `ip/uid/account_id`、全局封顶。
3. 前端（地基）：`custom-icons.ts` 改账号级；`useCustomIcons` 改调 RPC（并集，`created_at` 最早占名）；新增 `useMyLibrary`；IconLibrary 页**数据源**改账号级；简繁 `normalizeName()` 纳入。
4. 存储策略：放开 `{account_id}` 文件夹写入（旧 `{list_id}` 策略保留兼容）。
5. 冒烟：换设备找回后图标在；家人同名自动显示（先画者占名）；删除回落；软门槛首用 2 张通过。

### v1.1 — fast-follow（纯前端，无需再迁移）

6. 复用选择器（AddSheet 内联缩略图 + 点选写 `list_icon_assignments` + 「查看全部」网格）。
7. IconLibrary 打磨：搜索框、「用自定义替换预设」写指派。
8. 冒烟：复用选择器写指派生效、指派覆盖并集。
