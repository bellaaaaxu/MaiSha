# 多清单 UX 设计

> 状态：定稿　|　日期：2026-06-04　|　关联记忆：[[multi-list-idea]]　|　地基依赖：[2026-05-28 数据持久化恢复 spec](2026-05-28-data-persistence-recovery-design.md)（账号实体已上线）、[2026-05-31 账号化图标库 spec](2026-05-31-account-icon-library-design.md)（跨清单共用图标库已上线）

## 概述

一个账号下支持多个清单，**形态为「随手多清单」**——用户可频繁创建临时清单（旅行、聚会、年货），与少数长期清单（家里、办公室）并存。后端地基（`lists.account_id`、`getOrCreatePrimaryList`、`active-list.ts` 持久化指针、账号化图标库）已在 Phase 1 / 图标库 v1 落地，**本 spec 是 UX 层 + 一支轻量迁移（012）补齐 `state` / `pin_order` 两列**。

**单清单用户全程零变化**——这是分层导航的核心约束。

## 决策汇总（已确认）

| # | 决策 |
|---|---|
| 1 | 形态 = **随手多清单**；状态分三段：`pinned` / `active` / `archived`，**全部手动**（无自动归档） |
| 2 | 导航分层：**当前清单 = 落地主屏**（单清单零成本）→ 头部按钮进 **B「我的清单」**（含总结）→ 底部链接进 **A「全部清单」**（密集 + 归档） |
| 3 | 头部组合：`≡ ＋ 当前清单名 ＋ [一叠卡片图标] ＋ [纸飞机图标]`；`≡` 保留通用菜单符号；两颗水彩图标做成一对（由用户绘制） |
| 4 | 行操作 = **混合手势**：左滑（置顶/归档/删除三色块，iOS Mail 风）+ 长按（完整面板含重命名、分享链接/邀请码） |
| 5 | **无 emoji**——靠排版、暖色重点（橘色左条）、分区标题区分 |
| 6 | **最后一个 active+pinned 清单不能被删/归档**（防「无活动清单」状态，DB + 前端双护栏）；如果被删/归档的恰好是当前清单且仍有其它 active，bootstrap 自动 fallback 到下一个 active |
| 7 | 新建清单 = 头部 **「＋」绿淡彩按钮** → 半屏小表单（名称 + 可选起始超市，复用 onboarding UI） |
| 8 | **归档区默认折叠**（「N 个归档 ▸」） |
| 9 | 视觉运动：B 出场用 **Animated List** 安静错峰浮现；A 出场用 **Bounce Cards** 弹簧入场（stagger ~60ms） |
| 10 | 范围内的协作：每个清单仍按现有 `short_code` 独立分享；**多清单实时同步**与 [[icon-assets]] v2 同期再做 |

## 数据模型（迁移 012）

### `lists` 表新增两列

```sql
-- 012_list_state.sql
ALTER TABLE lists
  ADD COLUMN state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'pinned', 'archived')),
  ADD COLUMN pin_order integer;

-- 索引：B 视图按 (account_id, state, pin_order, updated_at) 排序
CREATE INDEX lists_account_state_idx ON lists (account_id, state);

-- 历史数据：onboarding 默认建的「家里」默认置顶（用户期望「家里」永远在最上）
UPDATE lists SET state = 'pinned', pin_order = 0
  WHERE name = '家里' AND state = 'active';
```

**说明**：
- `state` 三态枚举；`pin_order` 仅在 `state='pinned'` 时有意义（其他状态可 NULL）。
- 不引入「completed」状态——`purchase_history` 已覆盖「这次买完了」语义；`archived` 是清单整体级。
- 不引入 `cover_image` / `theme_color` 等装饰列——留给后续。

### RPC：`set_list_state` + 删除护栏

```sql
-- 设置状态（含护栏）
CREATE OR REPLACE FUNCTION set_list_state(
  p_list_id uuid,
  p_state text,
  p_pin_order integer DEFAULT NULL
) RETURNS lists
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_active_count integer;
  v_result lists;
BEGIN
  -- 成员校验（沿用现有 RLS 模式）
  SELECT account_id INTO v_account_id FROM lists
  WHERE id = p_list_id AND auth.uid() = ANY(member_uids);
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  -- 护栏：归档/删除最后一个 active+pinned 拒绝
  IF p_state = 'archived' THEN
    SELECT count(*) INTO v_active_count FROM lists
    WHERE account_id = v_account_id AND state IN ('active', 'pinned') AND id <> p_list_id;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'cannot archive the last active list';
    END IF;
  END IF;

  UPDATE lists SET state = p_state, pin_order = p_pin_order, updated_at = now()
  WHERE id = p_list_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION set_list_state(uuid, text, integer) TO anon, authenticated;
```

**删除护栏**：复用同样模式——`delete_list(p_list_id)` RPC 加同款 `v_active_count` 检查；前端 UI 在最后一个清单上**隐藏**删除/归档项（防御纵深）。

**重命名 / 新建**：现有 RLS 已允许成员 `UPDATE` 与 `INSERT`，前端直接走 supabase 客户端即可，不需要新 RPC。

## UI 分层

### 当前清单（已有 `/list`，仅改头部）

```
┌─────────────────────────────────────┐
│ ≡   家里               [🗂]  [✈]    │  ← 改：原标题「买啥」换成清单名
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │     原「邀请」文字换成纸飞机图标
│ [清单]  [历史]                       │     新增「🗂 一叠卡片」按钮
│ ...                                 │     新增「＋」按钮仅在 B 视图显示
```

- 标题文本：由 `t('app.title')`（「买啥」）改为当前 `list.name`。
- 「邀请」文字按钮 → `<PaperPlaneIcon />`（28×28，水彩 SVG，由用户绘制）；点击行为不变。
- 新增 `<ListSwitcherIcon />`（28×28，水彩 SVG）置于标题与纸飞机之间；点击 = `nav('/my-lists')`。
- `≡` 保留为系统字形，不水彩化（用户偏好）。

### B 视图：`/my-lists`（新路由）

布局：
```
┌─────────────────────────────────────┐
│ ←   我的清单                  ＋     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ 固定                                 │
│ ┃ 家里  [当前]                       │  ← 橘色左条 + [当前] tag
│ ┃ 8 件待买                           │
│ │ 办公室                             │
│ │ 3 件 · 楼下便利店                   │
│ 进行中                               │
│ │ 旅行                               │
│ │ 5 件 · 出发前清点                   │
│ 已归档 (3)  ▸                        │  ← 默认折叠
│                                     │
│ 查看全部 14 个 / 归档 →               │
└─────────────────────────────────────┘
```

**渲染规则**：
- `useLists(accountId)` hook 拉账号下所有清单，按 `state` 分组、按 `pin_order ASC, updated_at DESC` 排序。
- 每行 = `<ListRow>`：名称 + （当前 tag，仅活跃指针所在）+ 总结行（`N 件待买 · 店铺前缀，最多 2 个`）。
- 总结 `N 件待买` = `items.filter(!checked).length`（首次加载时全量；列表层做轻批量预取，避免 N+1）。
- 当前活动清单：橘左条 + `[当前]` tag。
- **归档段**默认 `collapsed=true`，展开状态存 `localStorage`（key: `maisha:archive-expanded`，per device）。

**出场动画**：每行 fade-in + translateX(-12px → 0)，stagger 80ms。

### A 视图：`/all-lists`（新路由）

布局：
```
┌─────────────────────────────────────┐
│ ←   全部清单                  14     │
│ 固定 · 进行中                         │
│ [家里 8件] [办公室 3件] [妈妈家 2件]  │
│ [旅行 5件] [年货]     [露营 12件]    │
│ 已归档                               │
│ [生日聚会] [装修]     [搬家]         │
│ [中秋]     [春节年货] [乔迁]         │
└─────────────────────────────────────┘
```

- 3 列 grid，每卡 48×62px，仅名 + 一行总结。
- 已归档行用降饱和度（`color: #ab9f93`、`background: #f4efe8`）。
- 出场：Bounce-in（`translateY(15px) scale(.6) → translateY(0) scale(1)`），cubic-bezier(.34,1.56,.64,1)，stagger 60ms。

### 行操作（混合手势）

**轻点行** → `persistActiveList(account, that_list)` → `nav('/list')`，横向 slide-in。

**左滑行**（`<SwipeableRow>`）：手指水平拖到 -126px 锁定，露出三个 42px 色块：
| 色块 | 颜色 | 动作 |
|---|---|---|
| 置顶 / 取消置顶 | `#d6a06f` 棕橘 | `set_list_state(id, 'pinned' \| 'active', pin_order)` |
| 归档 | `#b1a18a` 暖灰 | `set_list_state(id, 'archived')`（含护栏） |
| 删除 | `#b06a5a` 暖红 | `delete_list(id)`（含护栏）+ 二次轻点确认 |

行为细节：
- 左滑展开时**禁用长按**；长按触发时长沿用现有 `src/hooks/useLongPress.ts` 默认。
- 删除色块：单击不删，再点一次或左滑超过 -180px 才执行（防误删）；显示「确认删除」红字。
- 桌面鼠标无左滑：依赖长按面板提供同等操作。

**长按行** → `<ListActionSheet>` 半屏弹起：
- 重命名 · 置顶/取消置顶 · 分享链接/邀请码 · 归档 · 删除
- 「分享链接/邀请码」= 现有 `onShareMenu` 但针对**那一行清单**（不限于当前）。
- 命名风格沿用现有 `MoreMenu`：暖色背景、列表项 + 抓手条。

### 新建：头部「＋」→ `<NewListSheet>`（半屏）

```
┌─────────────────────────────┐
│ 新建清单                  × │
│                             │
│ 名称: [_______________]     │
│                             │
│ 起始超市（可选）：           │
│ [永辉] [山姆] [盒马] +      │  ← 复用 onboarding 选择 UI
│                             │
│      [取消]   [创建]        │
└─────────────────────────────┘
```

- 名称 ≤ 20 字符，去空白后非空。
- 起始超市：复用 onboarding step 2 的选择 chips（已存在）；为空时使用 `DEFAULT_STORES`。
- 创建后自动切换为当前清单（持久化 + `nav('/list')`）。

## 文件清单

| 文件 | 动作 | 责任 |
|---|---|---|
| `supabase/migrations/012_multi_list.sql` | 新建 | `state` / `pin_order` 列 + 「家里」回填置顶 + 索引 + `set_list_state` / `delete_list` RPC（含护栏，单文件一次写） |
| `src/lib/db.ts` | 改 | 新增 `createList(accountId, uid, name, stores)` / `renameList(id, name)` / `setListState(id, state, order?)` / `deleteList(id)` |
| `src/hooks/useLists.ts` | 新建 | 拉账号名下所有清单，按 state 分组+排序；含 items count 批量预取 |
| `src/components/ListSwitcherIcon.tsx` | 新建 | 一叠卡片 SVG，水彩描边 + 淡橘填充（由用户绘制） |
| `src/components/PaperPlaneIcon.tsx` | 新建 | 纸飞机 SVG，同套水彩规格 |
| `src/components/ListRow.tsx` | 新建 | 一行清单的渲染 + 左滑 + 长按手势接入；emit `onSwipeAction(action)` / `onLongPress()` |
| `src/components/ListActionSheet.tsx` | 新建 | 长按完整面板（沿用 `MoreMenu` 风格） |
| `src/components/NewListSheet.tsx` | 新建 | 半屏新建表单 |
| `src/routes/MyLists.tsx` | 新建 | B 视图（固定 / 进行中 / 归档区折叠） |
| `src/routes/AllLists.tsx` | 新建 | A 视图（3 列 grid + Bounce 入场） |
| `src/routes/List.tsx` | 改 | 头部标题 = 清单名；插入 `<ListSwitcherIcon />` + 替换文字「邀请」为 `<PaperPlaneIcon />` |
| `src/App.tsx` | 改 | 加路由 `/my-lists`、`/all-lists` |
| `src/types/list.ts` | 改 | 加 `state` / `pin_order` 字段 |
| `src/i18n.ts` / locale 文件 | 改 | 加文案：「我的清单」「全部清单」「新建清单」「固定」「进行中」「已归档」「重命名」「置顶」「取消置顶」「归档」「删除」「N 件待买」等三语 |

## 验证 / 自测要点

**手动冒烟**（部署后必跑）：
1. 单清单用户首屏：标题显示「家里」，纸飞机替换文字邀请 ✓
2. 点一叠卡片 → B 出现安静浮现，「家里」橘左条 + [当前] tag ✓
3. ＋ 新建「测试 2」→ 自动切到「测试 2」，回 B 看到两行 ✓
4. 左滑「测试 2」→ 三色块；点置顶 → 自动入「固定」段顶部 ✓
5. 长按「测试 2」→ 面板；重命名为「测试」→ 立即反映 ✓
6. 归档「测试」→ 进入折叠归档段（点 ▸ 展开可见）✓
7. 在归档段长按「测试」→ 删除 → 二次点击确认 → 移除 ✓
8. **删除当前清单**（在「测试」是当前的状态下从 B 删除）：app 静默 fallback 到「家里」，无错误 ✓
9. **护栏**：在只剩「家里」一个清单时左滑归档 → 三色块里归档/删除应灰禁 + DB 拒绝（双重防御）✓
10. 「查看全部」→ A 视图 Bounce 入场 ✓
11. 共享清单：邀请家人加入「家里」后，家人 B 视图能看到「家里」（与他的本地清单并列），家人无法对该行删除（仅 owner 可？此处沿用现有 RLS——`delete_list` 默认任何成员都能删；如要 owner-only，需在 RPC 加 `auth.uid() = owner_uid` 检查。**留作 follow-up，v1 沿用现有所有人可删模式**）。

**单元测试**：
- `useLists` 排序：pinned (pin_order ASC, NULLS LAST) → active (updated_at DESC) → archived (updated_at DESC)
- 「最后 active 清单」护栏：归档 / 删除均拒绝
- `set_list_state` 从 archived 回 active 时 `pin_order = NULL`

**typecheck + vitest run + build** 全绿。

## 范围 / 后续（明确推后）

| 项 | 留给 |
|---|---|
| **多清单实时同步**（家人 A 加项，家人 B 的 B 视图总结实时变） | 与 [[icon-assets]] v2 实时同步同期 |
| **清单封面图** / 主题色 | 后续 polish |
| **复制清单 / 模板** | 等用户反馈 |
| **批量操作**（多选归档/删除） | 观察用户行为 |
| **跨清单搜索物品** | 等用户反馈 |
| **拖拽重排固定段**（pin_order 手动调） | 留 follow-up；v1 仅按置顶时间倒序 |
| **owner-only 删除权限** | 沿用现有「成员皆可删」；若投诉再加 RPC 校验 |

## 关联与影响

- **图标库**：跨清单**已**共用（账号级 union），无需额外工作。
- **数据恢复**：账号找回码 = 拉回全部清单，与现状一致。
- **AddSheet 复用选择器**：在新建清单内同样工作（v1.1 已上线）。
- **onboarding**：不改动；首启仍建一个「家里」清单（直接置顶）。
- **app 定位**：「按店铺备忘、个人为主、分享为辅、简单有温度」——本设计无新功能膨胀，只是把已有地基暴露给用户。
