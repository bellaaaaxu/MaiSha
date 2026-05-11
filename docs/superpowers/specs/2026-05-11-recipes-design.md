# 买啥 MaiSha — 菜谱功能设计

**Date:** 2026-05-11
**Status:** Draft (awaiting user review)
**Scope:** MVP（官方菜谱库 + 家庭私有菜谱），社区层延后

---

## 1. 背景与目标

### 1.1 问题

用户在做家常菜时反复购买同一组食材，比如做"红烧肉"每次都要手动添加五花肉、老抽、生抽、糖、葱姜蒜——重复劳动。同时，市面上的菜谱 app（下厨房、Paprika）专注做法，没人专门为"中餐家常菜的购物侧"做轻量工具。

### 1.2 目标

让用户**一键把一个菜的所有食材加进购物清单**。不教做菜，只解决"我今天想做 X，要买啥"。

### 1.3 非目标

- **不做做菜步骤说明**（不是菜谱书）
- **不做营养信息 / 卡路里**
- **不做用户社区 / 评论 / 评分**（MVP 阶段）
- **不做 AI 即时生成菜谱**（成本和准确度都不划算）

### 1.4 关键洞察

1. **食材列表比做法稳定**：99% 的人做红烧肉都需要那 6-8 样东西，差异只在"放不放八角"这种小细节。所以菜谱可以共享，不会因口味不同而失效。
2. **购物清单 app 不需要完整菜谱**：只需要食材名 + 数量，剩下都是噪音。
3. **图标库就是地基**：买啥已有的水彩食材图标库直接复用，菜谱不需要新视觉资产。

---

## 2. 三层菜谱架构

为了在保持 MVP 简单的同时为未来扩展铺路，设计成三层：

| 层 | source 字段 | MVP 阶段 | 说明 |
|---|---|---|---|
| **官方精选** | `'official'` | ✅ 实现 | 你手工策划的 10-15 个家常菜种子库，所有用户可读 |
| **家庭私有** | `'list'` | ✅ 实现 | 每个共享清单的成员可读可写，自定义"我家的菜" |
| **社区公开** | `'public'` | ⏸️ 预留字段 | 家庭主动分享出去给所有人浏览，需要审核机制，MVP 不做 |

数据模型预留 `source='public'` 字段值，UI 暂不暴露入口，将来加社区层不需要 schema 迁移。

### 2.1 为什么需要官方层

公开 app 最大的死亡陷阱是**空状态**：新用户打开看到"暂无菜谱"会立刻退出。官方库直接解决这个问题——首次打开就有 10+ 个可用菜谱。

### 2.2 为什么需要家庭 fork

每家做菜口味不同（"我家不放八角"、"妈妈的红烧肉多放糖"），但又不需要从零开始写整个菜谱。Fork 流程让用户在官方库基础上**减法定制**，比从零开始建菜谱低门槛得多。

---

## 3. 数据模型

### 3.1 新表 `recipes`

```sql
CREATE TABLE recipes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL CHECK (source IN ('official', 'list', 'public')),
  list_id      UUID REFERENCES lists(id) ON DELETE CASCADE,  -- null for 'official'/'public'
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '家常菜',                -- 川菜 / 粤菜 / 家常菜 / 早餐 / ...
  emoji        TEXT NOT NULL DEFAULT '🍳',
  ingredients  JSONB NOT NULL,                                -- 见 3.2
  forked_from  UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipes_list ON recipes(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX idx_recipes_source ON recipes(source);
```

**关键决策：**
- `ingredients` 用 JSONB 而不是另开关系表——菜谱永远整存整取，不会按食材跨菜谱查询
- `forked_from` 保留 fork 关系，未来可统计"基于官方版的改进"或做回流推荐
- `list_id` 在 `source='official'` 或 `'public'` 时为 null

### 3.2 `ingredients` JSON 结构

```typescript
type Ingredient = {
  name: string;            // '五花肉'（必须能在 icon-registry 里匹配，否则 fallback 到 emoji）
  quantity?: string;       // '500g' / '2勺' / '一把'，自由文本仅作显示
  supermarket?: string;    // 'tnt' 等。不设 → 用 AddSheet 顶部当前选择
  optional?: boolean;      // true → 添加预览里默认不勾选
};

type Ingredients = Ingredient[];  // 顺序就是显示顺序
```

### 3.3 RLS 策略

```sql
-- 官方菜谱：所有人可读，只有 service_role 可写
CREATE POLICY "anyone read official" ON recipes
  FOR SELECT USING (source = 'official');

-- 家庭菜谱：清单成员可读可写
CREATE POLICY "list members read recipes" ON recipes
  FOR SELECT USING (
    source = 'list' AND list_id IN (
      SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );

CREATE POLICY "list members write recipes" ON recipes
  FOR ALL USING (
    source = 'list' AND list_id IN (
      SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)
    )
  );

-- 'public' 源 MVP 不开放，预留
```

### 3.4 种子菜谱（migration 直接 INSERT）

MVP 阶段手工准备 10-15 个，可候选：

| 菜名 | emoji | 分类 |
|---|---|---|
| 红烧肉 | 🥩 | 家常菜 |
| 番茄炒蛋 | 🍅 | 家常菜 |
| 麻婆豆腐 | 🌶️ | 川菜 |
| 青椒土豆丝 | 🥔 | 家常菜 |
| 糖醋排骨 | 🍖 | 家常菜 |
| 蛋炒饭 | 🍚 | 主食 |
| 西红柿鸡蛋面 | 🍜 | 主食 |
| 白菜炖豆腐 | 🥬 | 家常菜 |
| 鱼香肉丝 | 🌶️ | 川菜 |
| 韭菜炒鸡蛋 | 🥚 | 家常菜 |
| 红烧鸡翅 | 🍗 | 家常菜 |
| 凉拌黄瓜 | 🥒 | 凉菜 |

每个菜谱的食材必须先在 `icon-registry.ts` 里能匹配到。如果某菜需要"豆腐"但图标库还没有，先去 registry 加一条并配图，再写菜谱。

---

## 4. UI 设计

### 4.1 入口：AddSheet 加 tab 切换

```
┌─────────────────────────────┐
│  添加物品              关闭  │
├─────────────────────────────┤
│  [ 食材 ]    菜谱            │  ← 新增 tab
├─────────────────────────────┤
│  添加到 [超市选择 chips]     │  ← 复用现有，对两个 tab 都生效
│  🔍 搜索...                  │
│  ...                         │
└─────────────────────────────┘
```

**理由**：菜谱本质上是"批量添加食材的快捷方式"，跟单个食材添加同属"往清单加东西"，同一个 sheet 最直接。**复用顶部的超市选择器**——选 T&T 后切到菜谱 tab，添加的食材都进 T&T（除非单个食材另指定）。

### 4.2 菜谱 tab 内容

```
┌─────────────────────────────┐
│  [全部] 川菜 家常 早餐 凉菜  │  ← 横向滚动分类筛选
├─────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐       │
│  │ 🥩 │ │ 🍅 │ │ 🌶️│       │
│  │红烧肉│ │番茄蛋│ │麻婆豆腐│
│  │官方 │ │我家 │ │官方 │       │
│  └────┘ └────┘ └────┘       │
│  ...                         │
├─────────────────────────────┤
│  [ + 添加我家的菜 ]          │
└─────────────────────────────┘
```

- 两列网格（视觉与"常买"区一致）
- 每张卡片：emoji + 菜名 + 来源标签（"官方" / "我家"）
- 底部固定 CTA `+ 添加我家的菜` → 跳转新建页

### 4.3 食材预览（二级 sheet）

点击菜谱卡片，从底部弹出二级 sheet 盖在 AddSheet 上：

```
┌─────────────────────────────┐
│         🥩 红烧肉            │
│         官方菜谱             │
├─────────────────────────────┤
│  添加到：T&T 大统华  ▾       │  ← 复用上层超市选择
├─────────────────────────────┤
│  ☑  🥩 五花肉  500g  · T&T 🏪│  ← 食材自带超市覆盖
│  ☑  🌰 老抽    2勺           │
│  ☑  🌰 生抽    1勺           │
│  ☑  🧂 糖      1勺           │
│  ☑  🧄 大蒜    3瓣           │
│  ☑  🌿 生姜    1块           │
│  ☐  ⭐ 八角    2颗   可选    │  ← 可选项默认不勾
│  ✓  🍳 鸡蛋          已在清单 │  ← 已存在，默认不勾
├─────────────────────────────┤
│ [ 保存为我家的 ] [ 添加 6 项 ]│
└─────────────────────────────┘
```

**交互规则：**
1. 默认全选必需食材，可选食材（`optional: true`）默认不选
2. "已在清单"的食材灰显且默认不勾选，但用户可手动勾选（"我要再买一份"场景）
3. 食材图标用 `getIconPath(name)` 解析，匹配上显示水彩图，匹配不上 fallback 到 emoji
4. 每个食材如果有 `supermarket` 字段，在右侧显示小超市标签；没有则用顶部选择
5. "添加 N 项"按钮：N 实时反映勾选数，点击批量调用 `addItem()` 创建多个 item，完成后关闭 sheet
6. "保存为我家的"按钮**仅在浏览 `source='official'` 的菜谱时显示**，点击执行 fork

### 4.4 创建 / 编辑菜谱

独立路由 `/recipe/new` 和 `/recipe/:id/edit`：

```
┌─────────────────────────────┐
│  ←  新建菜谱           保存  │
├─────────────────────────────┤
│  菜名  [ 红烧肉           ]  │
│  分类  [ 家常菜 ▾ ]           │
│  图标  [ 🥩 ]                │  ← tap 弹小 emoji 选择器
├─────────────────────────────┤
│  食材                        │
│  ┌──────────────────────┐   │
│  │ 🥩 五花肉           ✕ │   │
│  │ 数量 500g   ☐ 可选    │   │
│  │ 超市 [ T&T ▾ ]       │   │
│  └──────────────────────┘   │
│  ...                         │
│  [ + 添加食材 ]              │
└─────────────────────────────┘
```

**关键点：**
- **"+ 添加食材"复用 AddSheet 的图标选择器（选择模式）**——选食材不直接进购物清单，而是回填到食材表。保证食材名一定能匹配图标。
- 每个食材一个卡片，三个字段（数量 / 可选 / 超市）默认折叠在简单形式，超市下拉默认值为"默认"（即用 sheet 顶部选择）
- 分类默认"家常菜"；emoji 根据第一个食材的 category 自动猜（肉类→🥩、蔬菜→🥬、面食→🍜，猜不到 fallback 🍳）

### 4.5 Fork 流程

1. 在官方菜谱预览页点"保存为我家的"
2. 后端 INSERT 一条新 row：`source='list'`, `list_id=当前清单`, `forked_from=原ID`, `ingredients` 完整复制
3. 前端立即跳转 `/recipe/:newId/edit`（**fork = 立刻编辑**，因为定制化是核心价值，不是悄悄收藏）
4. 用户可以：减食材（"我家不放八角"）、改数量、改超市分配、改菜名（"妈妈的红烧肉"）

### 4.6 删除

- 家庭菜谱编辑页右上角 ⋯ → "删除菜谱"（带二次确认）
- 官方菜谱不可删除，用户只能 fork 后定制
- 删除一个被 fork 的菜谱不影响 fork 的副本（`forked_from` 设为 NULL，via `ON DELETE SET NULL`）

---

## 5. 智能加分项

不增加用户操作但提升体验的细节：

### 5.1 已存在食材的自动识别
食材预览页加载时，对每个食材跑一遍 `items.find(i => i.name === ingredient.name && !i.checked)`。匹配到的标"已在清单"灰显，避免重复添加。

### 5.2 基于历史的超市推荐
食材预览页加载时，如果某食材没有 `supermarket` 字段，去 `frequent-items` 历史里查这个食材以前都买的哪家超市。匹配到就预填一个推荐标签（区别于硬编码的强制标签）。**未 fork 用户也能享受到部分智能。**

### 5.3 验证规则
- 菜名非空、单清单内唯一（防止两个"红烧肉"）
- 食材至少 1 个
- 食材名建议（不强制）能在 icon-registry 里匹配

---

## 6. 实现拆分（建议顺序）

1. **数据层**：建表、RLS 策略、写 migration、插入 12 个种子菜谱
2. **类型 + hook**：`Recipe` 类型、`useRecipes(listId)` 拿当前清单可见的所有菜谱（official + 自家 list）、`addRecipe` / `updateRecipe` / `deleteRecipe` / `forkRecipe`
3. **AddSheet tab 切换**：把现有食材网格抽成 `<IngredientPicker>`，新增 `<RecipePicker>` tab
4. **食材预览 sheet**：`<RecipePreviewSheet>` 组件，含勾选、批量添加、智能识别
5. **菜谱编辑页**：`/recipe/new` 和 `/recipe/:id/edit` 路由，复用 `<IngredientPicker>` 作为选择模式
6. **Fork 流程**：按钮 + 后端 RPC + 跳转
7. **测试**：核心 hook 单测 + 关键路径手动验证

---

## 7. 路线图（未来）

- **v2.1**：基于人数缩放食材数量（一家三口 vs 单身）
- **v2.2**：菜谱排版分享给微信（"这是我家的红烧肉，要不要复制一份"）
- **v2.3**：社区层 `source='public'`，opt-in 分享、热门菜谱、举报机制
- **v2.4**：本周菜单规划（拖几个菜到周一-周日，自动汇总食材到购物清单）
