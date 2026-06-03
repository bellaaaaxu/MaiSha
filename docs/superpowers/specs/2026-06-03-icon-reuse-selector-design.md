# 图标复用选择器 + 图标库搜索（v1.1）设计

> 状态：定稿　|　日期：2026-06-03　|　父 spec：[2026-05-31-account-icon-library-design.md](2026-05-31-account-icon-library-design.md)（v1 地基已上线并端到端验证）

## 概述

v1.1 给 v1 已建好但还没人写的 `list_icon_assignments`（**指派层**）接上**写入口**：

- **复用选择器（AddSheet）** — 头号功能：加物品时若该名字没图，从**全家并集的自定义图**里借一张给你输入的名字（写一条指派），物品立刻带图加入。
- **图标库页（IconLibrary）打磨**：加搜索框；「用自定义替换预设」沿用现有「新建同名自定义图」流程（v1 后已靠并集全局生效，零新代码）。

主体纯前端 + 一支**极小只读迁移（011）**暴露并集图标的 `id`（写指派要用）。

## 决策汇总（已确认）

| # | 决策 |
|---|---|
| 1 | 复用源：**全家并集**（所有清单成员账号的 custom icons），非仅「我的」 |
| 2 | 范围：复用选择器 + 库页搜索框；库页「替换」沿用现有并集流程，**不做按清单指派覆盖**（小众，留后） |
| 3 | 指派写入口：**仅复用选择器**（AddSheet 无图分支） |
| 4 | 借用对象：仅 `icon_library`（自定义图）；**预设不可跨名借**（`assignment.icon_id` FK `icon_library`） |
| 5 | 迁移：**011 仅新增只读 RPC** `get_reusable_icons`，无表结构变更 |

## 迁移 011（`011_reusable_icons_rpc.sql`）

为何需要：写指派要并集图标的 `id`，但 `icon_library` 的 RLS 只让你读自己账号的图，`get_list_icon_map` 又只返回 `image_path` 不返回 `id`。故需一支 SECURITY DEFINER 只读 RPC 暴露并集图标的 `id`。

```sql
CREATE OR REPLACE FUNCTION get_reusable_icons(p_list_id uuid)
RETURNS TABLE(id uuid, name text, image_path text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_members uuid[];
BEGIN
  SELECT member_uids INTO v_members FROM lists WHERE id = p_list_id;
  IF v_members IS NULL THEN RAISE EXCEPTION 'list not found'; END IF;
  IF NOT (auth.uid() = ANY(v_members)) THEN RAISE EXCEPTION 'not a member'; END IF;
  RETURN QUERY
    SELECT il.id, il.name, il.image_path, il.created_at
    FROM icon_library il
    WHERE il.account_id IN (SELECT a.id FROM accounts a WHERE a.member_uids && v_members)
    ORDER BY il.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_reusable_icons(uuid) TO anon, authenticated;
```

- 只读、成员校验、并集范围（同 `get_list_icon_map` 的 library 部分，但带 `id`、不含 assignment/preset 行）。无表/列/RLS 变更。

## A. 复用选择器（AddSheet）

- **触发**：`submitTyped` 现有「无预设、无并集同名」分支——判定改用 `resolveIconUrl(name, customIconMap) === null`（顺带修正现有 `i.name === name` / `customIconMap.has(name)` 的 raw-name 简繁不一致）。
- **取数**：进入该分支时调 `get_reusable_icons(listId)`（结果在 sheet 生命周期内缓存；若觉卡可在 open 时预取）→ 经 `getPublicIconUrl` 转 URL。
- **行内**：最近优先铺前 ~8 张缩略图 +「查看全部 ›」。文案：「给『{输入名}』选一张现成图」。
- **点选即用**：前端直插 `list_icon_assignments(list_id, 输入名, icon_id, set_by=uid)`（v1 010 的 insert RLS 已允许清单成员写）→ `toggleItem(输入名, {supermarket})` 加物品 → `onIconsChanged()` 刷新 → 并集 Map 含指派层 → 物品渲染借来的图。
- **查看全部 ›**：assign 模式整页可搜网格（锚定 `pendingItemName`，搜并集图名，点 = 指派 + 加）。
- **空态**：并集无可复用图（新账号、家人也没图）→ 不显示此行，直接现有 上传/AI/跳过。
- 下方 📷上传 / 🎨AI / 跳过（`IconPickerPanel`）**始终保留、不变**。

**新单元**：
- `src/components/ReuseIconRow.tsx`：行 + 缩略图 + 「查看全部」触发（props：`reusable: ReusableIcon[]`、`onPick(icon)`、`onViewAll()`）。
- `src/components/ReuseIconGrid.tsx`：「查看全部」打开的全屏 assign 模式网格，锚定 `pendingItemName`，可搜并集图名，点 = `onPick`。
- `src/lib/custom-icons.ts` 加：`fetchReusableIcons(listId): Promise<ReusableIcon[]>`（调 RPC）、`setListIconAssignment(listId, name, iconId, setBy)`（insert）。`ReusableIcon = { id, name, image_path }`。

## B. 图标库页打磨（IconLibrary）

- 顶部**搜索框**：过滤「我的 · N」+「预设 · N」（按 name/alias，经 `normalizeName` 归一）。纯前端、无数据变更。
- 「用自定义替换预设」：沿用现有 `NewIconSheet`（新建同名自定义图）→ v1 后已靠并集全局盖掉预设。**无新指派代码**。
- 不做按清单指派覆盖（留后）。

## 解析顺序（不变）

```
1. 清单指派 (list_icon_assignments)   ← v1.1 给这层接上写入口（复用选择器）
2. 成员库并集 (created_at 最早)         ← v1
3. 预设库                              ← v1
4. 水彩兜底                            ← v1
```

## 数据流

1. AddSheet 输入名无图 → `fetchReusableIcons` → `ReuseIconRow`。
2. 点选 → insert `list_icon_assignments` → `onIconsChanged()` → `useCustomIcons` 重新 `get_list_icon_map`（含 assignment 行）→ `buildIconMap`（指派覆盖在最上）→ 物品带借来的图。
3. 库里图被作者删 → assignment 经 v1 010 的 `ON DELETE CASCADE` 自动消失 → 回落并集/预设/兜底。

## 权限 / RLS（已就位，无新策略）

- `list_icon_assignments` insert/select：清单成员（v1 010）。前端直插即可。
- `get_reusable_icons`：SECURITY DEFINER + 入口成员校验，绕逐行 RLS 拿并集 `id`。

## 边界情况

- 名字在并集已有同名图 → 不进无图分支、不弹复用行（并集已自动解析）。
- 借的图之后被作者删 → 级联删指派 → 渲染回落。
- 输入名经 `normalizeName` 归一，与并集/指派 key 一致（修正现有 raw-name 判定）。
- 同一 `(list_id, name)` 再次指派 → upsert（`onConflict: list_id,name`）覆盖旧指派。

## 测试计划

- **RPC**：成员拿到并集（带 id）；非成员被拒；不含预设/assignment 行。
- **解析**：指派写入后 `get_list_icon_map` 指派覆盖并集（`buildIconMap` 优先级 v1 已单测）。
- **组件**：无图弹复用行；点选写指派 + 物品即带图；空态降级到 上传/AI/跳过；库页搜索过滤「我的+预设」。
- **回归**：现有 AddSheet 加物品（有图/直接）、上传、AI 生成路径不受影响。

## 上线步骤

1. migration `011`（仅 `get_reusable_icons` RPC）。**apply 前** `npx supabase` 已登录;`functions` 无关、仅 DB。
2. 前端：`custom-icons.ts` 加 `fetchReusableIcons` + `setListIconAssignment`;`ReuseIconRow` + assign 网格;`submitTyped` 无图分支接复用行;IconLibrary 加搜索框。
3. 冒烟:输入无图名 → 复用行出并集图 → 点选 → 物品带借来的图;空账号无行;库页搜索可用。

## 不在本期范围

- 图标库页 / 物品上的**按清单指派覆盖**（跨名 / per-list）——小众，留后。
- 跨名借**预设**（需 `assignment` 加 `preset_slug` 列，schema 改）——留后。
- 家人新图实时同步（v2）。
