# 查超市（反向超市发现）设计

> 日期：2026-06-14
> 状态：设计已确认，待写实现计划
> 一句话：用户「想买 A 但不知道去哪家超市」，输入商品 → AI 映射店类型 → 原生 MapKit 搜附近 → 一键落进清单，接回核心循环。

---

## 1. 背景与动机

MaiSha 现有核心循环是**正向**的：先选超市 → 在该店列表里挑商品 → 到店进购物模式打勾。

但有一类需求现有流程覆盖不了：**用户想买某样东西，却不知道哪家超市卖 / 哪家好。** 例如「我想买日本酱油，去哪买？」用户脑子里只有商品，没有店。本功能补上这个**反向入口**。

本质：一个把「不知道去哪买」的用户**导回现有核心循环**的漏斗——不是另起炉灶的独立子系统。

---

## 2. 场景与范围

### 2.1 v1 锁定的场景

用户带着**一个具体商品**的疑问主动来查（无清单上下文要求）：

```
想买「日本酱油」但不知道去哪
  → 进入「查超市」
  → 选/打商品「日本酱油」（复用 icon-registry 商品库 + 打字）
  → app 请求定位（首次）
  → 商品 → 店类型关键词（命中共享缓存则免 AI）
  → 原生 MapKit 用关键词搜附近 → 返回带距离的店列表
  → 点中一家「大华超市 · 日系超市 · 1.2km」
  → 一键「加进我的超市 + 把日本酱油加到该店清单」
  → 跳回 /list，接回核心循环（选超市→购物模式）
```

### 2.2 目标用户与地理

国内大城市 + 北美/加拿大华人聚集区。这两个区域决定了数据源选择（见 §4）。

### 2.3 v1 明确不做（YAGNI）

- **B 输入**：自然语言意图（「我想吃寿司」）→ v2
- **C 输入**：多商品「一站买齐最多」→ v2
- **拒绝定位时手输城市降级** → v2
- **Android / Web 支持** → 不做（iOS 独占，见 §4）
- **地图视图 / 导航 / 路线** → v2（v1 已存坐标，为此铺路）
- **众包「别人在哪买这个」** → v3
- **多设备实时同步** → 不适用

---

## 3. 关键决策记录

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| Q1 | 触发时机 | C：临时想买某样东西（独立入口） | 不是清单管理副产品，是带疑问主动查 |
| Q2 | 推荐池 | B：可推荐用户没加过的新店 | 多地区 + 长尾品类下，纯"自己已有店"或"AI 猜店类型"都不顶用 |
| Q3 | 平台 | A：iOS 独占 | MapKit 在中国走高德数据、北美走 Apple 数据，**一个免费接口覆盖两区域**；web 无等价免费源；v1 launch 本就是 iOS |
| Q4 | 输入颗粒度 | A：一个具体商品（v1）；B+C 留 v2 | AI 只需做一层"商品→店类型"映射，准确率最高，且能复用现成商品选择器 |
| 桥实现 | 商品→店类型 | 方案 1：纯 AI 实时映射 + 服务端共享缓存 | 零维护、覆盖长尾、天然多地区；缓存让它自动演化成众包标签库，免去手工标 276 个的苦工 |
| 入口 | 摆放 | A 主入口（AddSheet 选店步骤）+ B 次入口（独立） | 复用 AddSheet"必须先选店"的卡点当逃生口；独立入口对应纯场景 |
| 定位 | 插件拆分 | 官方 `@capacitor/geolocation`（权限+定位）+ 自写 `StoreSearch`（MKLocalSearch） | 官方插件权限流稳，自写插件只管搜，原生代码最少 |
| 降级 | 拒绝定位 | v1 仅友好提示，不做手输城市 | 求精简 |

---

## 4. 架构总览

三段式管道，外加 iOS 原生桥：

```
[商品输入]  →  [AI 桥 + 共享缓存]  →  [原生 MapKit 搜索]  →  [结果页 + 落清单]
 复用 icon-registry   resolve-store-types     StoreSearch.swift      StoreFinder.tsx
                      + store_type_hints      + @capacitor/geolocation
```

**数据源关键事实**：Apple Maps（MapKit）在中国大陆使用高德（AutoNavi）数据。所以 iOS 上 `MKLocalSearch` 一个接口同时覆盖国内大城市与北美华人区，**免费、Apple 原生、无需单独申请高德/Google key**——这是 iOS 独占的核心红利。

---

## 5. 组件设计

### 5.1 商品 → 店类型「桥」（方案 1）

#### Edge Function `resolve-store-types`
- 路径：`supabase/functions/resolve-store-types/index.ts`
- 照搬 `generate-icon/index.ts` 模式：`Deno.serve` POST + JWT 校验 + 限流 + 调 Gemini
- 模型：**`gemini-2.5-flash`（文本）**，端点 `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}`，复用现有 `GEMINI_API_KEY` 环境变量
- 输入：归一化后的商品名（复用图标库的简繁归一小词表）
- 输出：由具体到通用、中英混合的店类型关键词数组，带 tier：
  ```json
  [ {"term":"日系超市","tier":1}, {"term":"亚洲超市","tier":2},
    {"term":"进口食品店","tier":2}, {"term":"Japanese grocery","tier":1},
    {"term":"Asian supermarket","tier":2}, {"term":"大型超市","tier":3} ]
  ```
- 运行时逻辑：`归一化 → 查 store_type_hints → 命中即返回 → 未命中调 Gemini → 写回缓存 → 返回`

#### 共享缓存表 `store_type_hints`（migration 013，全局、不按账号隔离）
```sql
store_type_hints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_normalized TEXT UNIQUE NOT NULL,
  keywords        JSONB NOT NULL,           -- 上面那个 term/tier 数组
  source          TEXT NOT NULL,            -- 'seed' | 'ai'
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
)
```
- RLS：所有登录用户可 **读**；只有 Edge Function（service role）可 **写**
- 设计意图：全球第一个查某商品的人付一次 AI，之后所有人免费秒读 → 这张表被真实查询慢慢填成众包标签库

#### 预填充脚本 `scripts/seed-store-types.mjs`
- 照 `scripts/generate-item-icons.mjs` 模式，开发期把 **276 个 preset 商品**的关键词一次性灌进 `store_type_hints`（source='seed'）
- 一次性成本 ≈ $0.07
- 效果：绝大多数查询从第一天起即缓存命中、零延迟、零成本；只有用户打字的长尾新商品才触发实时 AI

#### 限流兜底
- 沿用全局 100/天软上限思路挡异常刷量，但用**独立计数**（新建轻量计数，或在 `ai_generation_log` 加 `kind` 列区分），**不与图标生成配额混用**——图标是图片调用（贵）、店类型是文本调用（便宜），不应互相挤占
- 由于绝大多数查询命中 `store_type_hints` 缓存、不触发实时 AI，这个上限基本只在异常刷量时起作用
- 撞上限时**不硬失败**，降级为通用词搜索（见 §8）

### 5.2 原生 MapKit + 定位桥（iOS-only）

现状（侦察确认）：Capacitor v8.3.4 纯 SPM；无定位插件、无 MapKit、无任何自定义原生代码；Info.plist 无定位权限 key。

#### 定位：装 `@capacitor/geolocation`
- 官方插件，负责权限申请 + 取当前经纬度
- 在 `ios/App/App/Info.plist` 手动加 `NSLocationWhenInUseUsageDescription`，文案三语友好（如「买啥需要你的位置，帮你找附近卖这件商品的超市」）

#### 搜店：自写 Capacitor 插件 `StoreSearch`
- 路径：`ios/App/App/Plugins/StoreSearch.swift`（~100 行），挂进 `ios/App/CapApp-SPM/Package.swift`
- 接口：`search({ queries: string[], lat: number, lng: number })` → 返回
  ```ts
  Array<{ name: string; lat: number; lng: number; address: string;
          distanceMeters: number; matchedTerm: string; category: string }>
  ```
- 内部：对关键词数组**逐个跑 `MKLocalSearch`**（region 以用户位置为中心）→ **按（名称 + 坐标≈50m）合并去重** → 算距离 → 排序，全在 Swift 内完成，JS 只调一次

#### 搜索编排
- 只跑 tier 1+2 关键词（通常 3~4 个）；若全落空再降到 tier 3 通用词
- 控制原生搜索调用次数（MKLocalSearch 免费且快，但不无脑跑全部）
- 结果按距离排序，每条带 `matchedTerm` 标签

#### iOS-only 门控
- `Capacitor.getPlatform() === 'ios'` 才显示入口
- Web / Android：§6 的两个入口直接隐藏，用户无感
- 给插件写 **web fallback stub**：`npm run dev` 时原生插件不存在，stub 返回「不可用」，保证 dev/构建不崩；可返回假数据供前端开发

### 5.3 前端编排层 `src/lib/store-finder.ts`
- 串起：（归一化商品名 → 调 `resolve-store-types` 拿关键词）→（`@capacitor/geolocation` 取位置）→（调 `StoreSearch` 插件搜店）→（点选后落清单）
- 落清单逻辑见 §6.3

---

## 6. 用户流程与 UI

### 6.1 入口（A 主 + B 次）

- **A 主入口**：`AddSheet.tsx` 选店步骤里加一条「🔍 不知道去哪买？帮我找」。用户正添东西、卡在"必须先选店"时的逃生口，复用现有摩擦点，不增加界面元素。
- **B 次入口**：独立入口，对应"临时想买、无清单上下文"。主列表头部已有 4 图标偏挤，更适合带文字的小入口或空清单态露出。
- 两个口子都通向同一个 `/store-finder` 页。v1 至少先做 A。

### 6.2 结果页 `src/routes/StoreFinder.tsx`（新路由 `/store-finder`）
- 路由加在 `src/App.tsx` 的 `AuthedApp` Routes 块
- 顶部：所查商品（图标用 `resolveIconUrl`，无则 `WatercolorFallback`）
- 列表：按距离排序的店卡，沿用水彩卡片风（`--paper / --shadow-card / --radius-card`）：
  > 🏪 **大华超市** · `日系超市` · 1.2km
  > 中山路 88 号
- `matchedTerm` 当标签，让用户懂"为什么是这家"

### 6.3 点一家店 = 闭合回路（核心动作）
1. 若该店**已在用户超市列表**（按名称 + 坐标≈匹配）→ 不重复加，直接把商品塞进该店
2. 若是**新店** → `updateListSupermarkets()` 把它加进 `lists.supermarkets`（带位置字段）
3. `addItem()`：商品名 = 所查商品，`supermarket` = 该店 id
4. 跳回 `/list` → 用户看到商品已落在该店分组下 → 接回核心循环

### 6.4 空结果态
附近搜不到任何匹配 → 友好提示「附近没找到卖『日本酱油』的店」+「手动添加超市」兜底入口（走现有 `ManageStores`）。

---

## 7. 数据模型变更

### 7.1 `Store` 接口扩展（`src/types/store.ts`，向后兼容）
```ts
interface Store {
  id: string;
  name: string;
  lat?: number;      // 新增
  lng?: number;      // 新增
  address?: string;  // 新增
}
```
旧店没有这些字段不受影响。存了坐标，v2 的"附近去重匹配""地图导航"有数据基础。

> 注：「超市」不是独立表，而是 `lists.supermarkets` 这个 JSONB 数组；加店仍走现有 `updateListSupermarkets(listId, Store[])`，不引入新表。

### 7.2 新增 `store_type_hints` 表
见 §5.1。migration 013（当前最新为 012）。

---

## 8. 错误处理与边界

| 情况 | 处理 |
|---|---|
| Gemini 调用失败 / 撞 100/天上限 | **不硬失败**，降级搜通用词「超市 / supermarket」，用户仍能看到附近的店 |
| 拒绝定位 | 友好提示「需要定位才能找附近超市」+ 去开权限入口；v1 不做手输城市 |
| 离线 | 提示「查超市需要联网」（MapKit 必须联网） |
| 附近零结果 | 空态 + 手动加店兜底（§6.4） |
| 店已存在用户列表 | 按名称 + 坐标≈匹配，不重复加，直接塞商品 |
| 非 iOS（web/Android） | 入口隐藏，用户无感 |
| 商品不在 preset 目录（打字的） | 照常工作，AI 解析关键词；图标走 WatercolorFallback |

---

## 9. 测试策略

- **单测**：简繁归一化；`store_type_hints` 缓存命中/未命中；店去重匹配（名称 + 坐标）；"加新店 or 复用旧店"分支逻辑
- **Edge Function**：mock Gemini，测缓存读写 + 限流降级路径
- **原生插件**：web stub 返回假数据供 dev；真机冒烟跑完整漏斗（查商品 → 给定位 → 出店 → 点选 → 落清单）—— 沿用既有冒烟流程
- **i18n**：三语 key 齐全校验

---

## 10. i18n

新增 `storeFinder` 命名空间，三个 locale 文件同步（`src/locales/zh-CN.json` / `zh-TW.json` / `en.json`）。建议 key：`title / entryHint / searchPlaceholder / locationPrompt / locationDenied / searching / matchedTag / distance / addToList / noResults / addManually / offline`。

---

## 11. 成本

- **AI**：单次未命中查询 ≈ $0.00025（Gemini 2.5 Flash 文本 $0.30/$2.50 每百万 token）。共享缓存 + 276 预填充后，全生命周期总成本约个位数美元，一次性付清，经常性开销趋近 0。
- **MapKit / MKLocalSearch**：免费、无需 key（含在 $99/年 Apple Developer 内）。
- **Supabase 缓存表 / 定位**：忽略不计。
- 结论：AI 成本约等于零；最贵的地图部分 Apple 免费扛。

---

## 12. 改动清单

| 类型 | 文件 | 说明 |
|---|---|---|
| 新 migration | `supabase/migrations/013_store_type_hints.sql` | 全局共享缓存表 + RLS |
| 新 Edge Function | `supabase/functions/resolve-store-types/index.ts` | Gemini 文本映射 |
| 新离线脚本 | `scripts/seed-store-types.mjs` | 预填 276 presets |
| 新原生插件 | `ios/App/App/Plugins/StoreSearch.swift` + `CapApp-SPM/Package.swift` | MKLocalSearch 桥 |
| 装依赖 | `@capacitor/geolocation` + Info.plist 权限 key | 定位 |
| 新路由/页 | `src/routes/StoreFinder.tsx` + `src/App.tsx` | 结果页 |
| 新前端层 | `src/lib/store-finder.ts` | 编排：缓存→插件→落清单 |
| 改 | `src/types/store.ts` | 加 `lat/lng/address?` |
| 改 | `src/components/AddSheet.tsx` | 主入口「🔍 帮我找」 |
| 改 | `src/locales/{zh-CN,zh-TW,en}.json` | 新 `storeFinder` 命名空间 |
| 改 | `docs/ROADMAP.md` | 同 session 同步（按项目规矩） |

---

## 13. 收尾

按项目规矩，落地时同步更新 `docs/ROADMAP.md`（加入"进行中 / 已上线"）。
