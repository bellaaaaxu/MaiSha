# 买啥 MaiSha — Design Document (PWA)

**Date:** 2026-04-23
**Status:** Draft (awaiting user review)
**Scope:** v1 only. v2/v3 roadmap included for context but not in scope.

> **架构变更记录：** 原 2026-04-22 稿为微信小程序 + wxcloud。因个人小程序注册要求管理员微信绑定银行卡形成障碍，改用 **React PWA + Supabase**。功能、UI、数据模型结构保留；交付平台和后端替换。

---

## 1. 背景与目标

### 1.1 问题

家庭日常采购痛点：
- 平时想到要买的东西，到超市就忘了或漏掉
- 夫妻双方各自记在脑子里，没对齐，容易重复买或漏买
- 采购路线是"跑几家店"（菜场 + 盒马 + 山姆），需要按店组织清单
- 已有大而全的 app（AnyList、Paprika）功能过多、学习成本高

### 1.2 目标

做一个**轻量、共享、按超市组织**的购物清单 Web 应用，可作为 PWA 安装到手机主屏幕：
- 夫妻两人共用一张清单，实时同步
- 按"去哪家店买"分组
- 零注册、零登录、链接打开即用
- 打开 → 添加 / 打勾 → 分享给对方，三步核心流程无任何负担
- 未来可演进：添加 Capacitor.js 包装为 iOS/Android 原生 APP（上架应用商店）

### 1.3 非目标（v1 不做）

- 菜谱 / 下周菜单规划（放到 v3）
- 库存 / 拍照生产日期 / 过期提醒（放到 v2）
- 多清单（v1 只支持单一共享清单）
- 账号 / 密码登录（用匿名 token 自动识别）
- 服务器端完整审计（匿名 token 授权，"家用可信"模型）

### 1.4 参考对标

- **Bring!**：视觉分类、轻量交互
- **AnyList**：分享共享列表
- **Paprika**：v3 扩展点
- **Nowaste**：v2 扩展点

---

## 2. 用户与场景

### 2.1 用户画像

- **主要用户（发起者）**：在家记想买的东西、规划采购
- **协同用户（被邀请者）**：执行采购、打勾确认
- 两人都会：添加、勾选、删除物品

### 2.2 核心场景

| # | 场景 | 触发 | 核心操作 |
|---|---|---|---|
| 1 | 在家想起要买的东西 | 日常 | 打开 → 添加 |
| 2 | 出门前检视清单 | 采购前 | 浏览、调整超市归属 |
| 3 | 超市现场对照购买 | 采购中 | 切到对应超市 → 逐项打勾 |
| 4 | 让对方帮买 | 采购前 | 复制链接发微信给老公 |
| 5 | 同步知道对方买了什么 | 采购中 | 打开 app 看实时状态 |
| 6 | 清空已购，开始下一轮 | 采购后 | "清空已购" |

---

## 3. v1 功能范围

### 3.1 核心功能

1. **单一共享清单**：两个浏览器实例共享同一张清单
2. **按超市分组**：主视图按超市卡片分组（盒马 / 菜场 / 山姆 / 便利店 / 未分类）
3. **按品类副分组**：每个超市内部按品类（蔬菜 / 乳制品 / 日用等）配 emoji 做视觉锚点
4. **添加物品**：
   - 输入框带自动补全 + 拼音搜索
   - "常买" chips（基于使用频率的 top 6 物品，按设备本地存储）
   - "最近添加" chips（最近 5 次添加的完整条目）
   - 必填：名称；可选：备注（品牌/规格）、数量、超市、品类
5. **勾选/取消勾选**：点击 item → 打勾（变灰 + 划掉）；再点击 → 取消
6. **编辑/删除**：点 item 末尾 ⋮ → 弹菜单（编辑 / 删除 / 复制到下次）
7. **清空已购**：顶部 ⋯ 菜单 → 一键删除所有已勾选项
8. **邀请老公**：顶部 📤 → 生成并复制链接 → 你发微信给老公 → 他点开即加入
9. **实时同步**：两端任意操作，对方 1 秒内看到变化
10. **超市管理**：设置页可以增/删/改超市项（默认提供 6 个，用户可自定义）
11. **PWA 安装**：支持"添加到主屏幕"，离线可查看已加载清单

### 3.2 数据模型（PostgreSQL / Supabase）

**表 `lists`**
```sql
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '家里',
  owner_uid UUID NOT NULL,                    -- Supabase auth.users.id（匿名身份）
  member_uids UUID[] NOT NULL DEFAULT '{}',   -- 含 owner
  supermarkets JSONB NOT NULL,                -- [{ id, name, emoji }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**表 `items`**
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT DEFAULT '',
  quantity TEXT DEFAULT '',
  supermarket TEXT NOT NULL DEFAULT 'none',
  category TEXT NOT NULL DEFAULT '其他',
  category_emoji TEXT NOT NULL DEFAULT '📦',
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_list_id ON items(list_id);
```

### 3.3 默认品类-Emoji 映射

（与原版相同）

| 品类 | Emoji | 关键词示例 |
|---|---|---|
| 蔬菜 | 🥬 | 青菜、白菜、西红柿、黄瓜、土豆、胡萝卜… |
| 水果 | 🍎 | 苹果、香蕉、橙子、葡萄、草莓… |
| 肉蛋 | 🥩 | 猪肉、牛肉、鸡肉、鸡蛋… |
| 乳制品 | 🥛 | 牛奶、酸奶、奶酪、黄油… |
| 主食 | 🍚 | 米、面条、饺子、馒头… |
| 烘焙 | 🍞 | 面包、吐司、蛋糕… |
| 调料 | 🧂 | 盐、糖、酱油、醋、料酒… |
| 零食 | 🍪 | 饼干、巧克力、薯片… |
| 饮料 | 🥤 | 可乐、茶、咖啡、果汁… |
| 日用 | 🧻 | 纸巾、洗衣液、牙膏、洗发水… |
| 其他 | 📦 | （未匹配的默认归到这里） |

匹配逻辑：对物品 `name` 做子串包含检查，命中任一关键词 → 归类。匹配不到 → "其他"。用户也可以在编辑物品时手动改。

### 3.4 "常买"chips 的数据来源（浏览器 localStorage）

v1 不把频率统计放在数据库里。每次用户添加物品时，在**本地 localStorage** 累计：

```ts
// localStorage key: `maisha:frequent:${uid}`，value: 数组
[
  { name, note, supermarket, categoryEmoji, count, lastUsedAt },
  ...
]
```

- 添加 chips 时按 `count desc, lastUsedAt desc` 取 top 6
- 添加物品 → 聚合键（`name+note+supermarket`）已存在则 `count++`
- 清空浏览器数据会丢失频率记录（可接受：用几天后自然重建），核心清单数据依然在 Supabase 安全

### 3.5 身份与访问控制

**匿名身份**：使用 Supabase Anonymous Auth（每个浏览器实例启动时自动 sign-in，生成唯一 `auth.uid()`），持久化在 localStorage 里。用户无需注册。

**URL 分享流程**：
1. 你首次打开应用 → Supabase 匿名 sign-in → 得 uid `U1`
2. 后端自动创建 list，`owner_uid = U1`, `member_uids = [U1]`
3. 点"邀请老公" → 前端生成 URL：`https://maisha.vercel.app/?list=<listId>`
4. 你把 URL 发微信给老公
5. 老公点链接 → 浏览器匿名 sign-in → 得 uid `U2`
6. 前端读 URL query 里的 `list=<listId>` → 调 Supabase RPC `join_list(list_id)` → 后端把 `U2` 加入 `member_uids`
7. 从此他打开 URL 都能看到同一 list

**RLS (Row Level Security)**：
```sql
-- lists: 仅成员可读写
CREATE POLICY "members read list" ON lists
  FOR SELECT USING (auth.uid() = ANY(member_uids));
CREATE POLICY "members update list" ON lists
  FOR UPDATE USING (auth.uid() = ANY(member_uids));
CREATE POLICY "authenticated can create list" ON lists
  FOR INSERT WITH CHECK (auth.uid() = owner_uid);

-- items: 仅对应 list 的成员可读写
CREATE POLICY "members read items" ON items
  FOR SELECT USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "members insert items" ON items
  FOR INSERT WITH CHECK (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "members update items" ON items
  FOR UPDATE USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
CREATE POLICY "members delete items" ON items
  FOR DELETE USING (list_id IN (SELECT id FROM lists WHERE auth.uid() = ANY(member_uids)));
```

**RPC 函数（SECURITY DEFINER）**：
- `join_list(list_id UUID)`：添加 `auth.uid()` 到 `lists.member_uids`
- `clear_checked(list_id UUID)`：原子删除 `list_id` 下所有 `checked=true` 的 items（权限由 RLS 约束，调用者必须是成员）

### 3.6 冲突处理规则

| 情况 | 规则 |
|---|---|
| 两人同时勾选同一项 | Last-write-wins（`updated_at` 最新的为准，Postgres UPDATE 天然支持）|
| 两人同时添加同名物品 | 两条都保留（显示重复项，避免误合并）|
| 一方删除、另一方编辑 | 删除优先（DELETE 后 UPDATE 会返回 0 rows affected，客户端 Toast 提示）|
| 网络断开期间的本地改动 | 缓存在 React state，恢复后重试；Supabase Realtime 自动重连 |

---

## 4. UI 设计

### 4.1 主屏幕

```
┌────────────────────────────────┐
│ 买啥              📤  ⋯       │
│ 共享 · 7项待买                 │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │ 🛒 盒马 · 2项              │ │
│ │  🥛 乳制品                  │ │
│ │   ○ 伊利纯牛奶 1L × 2     ⋮│ │
│ │  🧻 日用                    │ │
│ │   ○ 心相印纸巾            ⋮│ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ 🥬 菜场 · 2项              │ │
│ │  🥬 蔬菜                    │ │
│ │   ○ 青菜                  ⋮│ │
│ │   ○ 西红柿 · 2斤          ⋮│ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ ❓ 未分类 · 2项            │ │
│ │   ○ 面包                  ⋮│ │
│ │   ✓ 酸奶 (已购) 划掉      ⋮│ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│         [ + 添加物品 ]         │
└────────────────────────────────┘
```

**交互**：
- 点击 item 主体：打勾/取消勾
- 点击 item 末尾 ⋮ 图标：弹弹层菜单（编辑 / 删除 / 复制到下次）
  - Web 没有可靠的 long-press，改用显式 ⋮ 按钮更通用
- 点击超市卡片头部：可折叠/展开
- 顶部 📤：打开"分享"弹层（复制链接 / 查看说明）
- 顶部 ⋯：清空已购 / 管理超市 / 设置

### 4.2 添加面板（底部弹层 / Modal）

```
┌────────────────────────────────┐
│ 添加物品                  关闭 │
├────────────────────────────────┤
│ 🔍 搜索或输入…                 │
├────────────────────────────────┤
│ 常买                           │
│ [🥛 牛奶] [🥚 鸡蛋] [🍎 苹果]  │
│ [🧻 纸巾] [🍞 面包] [🥬 青菜]  │
│                                │
│ 最近添加                       │
│ [🥛 伊利纯牛奶 1L]             │
│ [🥬 西红柿 2斤]                │
│ [🥛 蒙牛纯甄酸奶]              │
└────────────────────────────────┘
```

**交互**：
- 点 chip：直接加入清单（带上 chip 里的 note/quantity/supermarket）
- 输入框打字：实时从本地历史 + 内置词库模糊匹配
- 回车/点确认：新物品创建
- 默认 `supermarket = "none"`（未分类）

### 4.3 编辑物品面板

打开后显示字段：
- 名称（可改）
- 备注（可选）
- 数量（可选）
- 超市（下拉，从 `lists.supermarkets` 选）
- 品类 + emoji（自动推断，可手动改）
- [删除] [保存]

### 4.4 超市管理页

`设置 → 管理超市`：
- 列表显示当前所有超市（可拖动排序——v1 可以先不做拖动，纯列表也可）
- 每行：emoji + 名称 + 编辑 + 删除
- 底部 "+ 添加超市"

"未分类"超市不可删除。

### 4.5 邀请与分享

**邀请老公（点顶部 📤 按钮）**：
```
┌────────────────────────────────┐
│ 邀请老公                  关闭 │
├────────────────────────────────┤
│ 把链接发给老公：                │
│ ┌────────────────────────────┐ │
│ │ https://maisha.vercel.app/ │ │
│ │ ?list=abc-123-def          │ │
│ └────────────────────────────┘ │
│       [ 复制链接 ]              │
│                                │
│ 复制后打开微信粘贴给老公，他    │
│ 点链接就能加入清单。            │
├────────────────────────────────┤
│ 或导出为文本：                  │
│ [ 复制清单文本 ]                │
└────────────────────────────────┘
```

**已加入后**：📤 按钮变为"分享"，弹层少了上半（已经一起了），主要功能是"复制清单文本"。

### 4.6 视觉规范

- **主色**：微信绿 `#07c160`（延续跨平台视觉延续性，但不是强绑定）
- **辅色**：
  - 已勾选（灰）`#999`
  - 警示（红）`#f56c6c`
  - 强调（蓝）`#2563eb`
- **字号（mobile-first, base 16px）**：item 名 15px，note 13px，分组标题 12px
- **圆角**：卡片 12px，按钮 8px，chip 14px
- **字体**：系统字体栈 (`system-ui, -apple-system, "PingFang SC", sans-serif`)
- **Tailwind 配置**：默认 spacing 系统 + 自定义主色

### 4.7 响应式

- Mobile-first 设计（375px-414px 典型手机宽度）
- 桌面浏览器：最大 480px 居中显示，两侧留白（避免在大屏上被拉宽影响体验）

---

## 5. 技术栈与架构

### 5.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | **React 18 + TypeScript** | 生态最大、类型安全、AI 辅助开发匹配度高 |
| 构建工具 | **Vite** | 热更新极快、PWA 插件完善、TS 原生支持 |
| 路由 | **React Router v6** | 事实标准 |
| 样式 | **Tailwind CSS** | 移动优先、无需设计稿也能快速迭代 |
| PWA | **vite-plugin-pwa** (`@vite-pwa/vite`) | 自动生成 manifest + service worker |
| 后端 | **Supabase** (免费版) | Postgres + Auth + Realtime + RLS 一站式 |
| 认证 | **Supabase Anonymous Auth** | 零注册，每浏览器实例唯一身份 |
| 实时 | **Supabase Realtime** | WebSocket 基于 Postgres WAL 的订阅 |
| 测试 | **Vitest + React Testing Library** | Vite 原生集成，API 与 Jest 兼容 |
| 部署 | **Vercel** (或 Cloudflare Pages) | 免费、GitHub 推送自动部署、全球 CDN |

### 5.2 项目结构

```
src/
├── main.tsx                # Vite 入口，挂载 <App />
├── App.tsx                 # 根组件：路由 + Supabase 初始化
├── index.css               # Tailwind 入口 + 少量全局样式
├── routes/
│   ├── Onboarding.tsx      # 首次引导
│   ├── List.tsx            # 主清单
│   ├── EditItem.tsx        # 编辑物品
│   ├── ManageMarkets.tsx   # 管理超市
│   └── Settings.tsx        # 设置
├── components/
│   ├── ItemRow.tsx         # 单行物品
│   ├── SupermarketCard.tsx # 超市卡片（折叠/展开）
│   ├── AddSheet.tsx        # 添加面板（Portal-based modal）
│   ├── Chip.tsx            # 通用 chip
│   ├── ItemMenu.tsx        # ⋮ 菜单
│   ├── ShareSheet.tsx      # 分享面板
│   ├── LoadingState.tsx    # 加载
│   └── EmptyState.tsx      # 空清单
├── hooks/
│   ├── useAuth.ts          # 匿名 sign-in + uid
│   ├── useList.ts          # 当前 list 数据 + realtime
│   └── useItems.ts         # items 数据 + realtime
├── lib/
│   ├── supabase.ts         # Supabase client 初始化
│   ├── auth.ts             # 匿名 sign-in / uid 管理
│   ├── db.ts               # CRUD 封装
│   └── realtime.ts         # Supabase Realtime 订阅封装
├── utils/
│   ├── constants.ts        # DEFAULT_SUPERMARKETS + CATEGORY_DEFS
│   ├── category-matcher.ts # 关键词 → 品类（纯函数，Vitest 可测）
│   ├── frequent-items.ts   # localStorage 频率（Vitest 可测）
│   ├── group-items.ts      # 分组算法（Vitest 可测）
│   └── share-text.ts       # 分享文本生成（Vitest 可测）
└── types/
    ├── list.ts
    ├── item.ts
    └── supermarket.ts

supabase/
├── migrations/
│   └── 001_initial_schema.sql
└── config.toml

public/
├── icon-192.png            # PWA 图标
├── icon-512.png
└── favicon.ico

tests/
├── category-matcher.test.ts
├── frequent-items.test.ts
├── group-items.test.ts
└── share-text.test.ts

docs/
├── superpowers/specs/...
├── superpowers/plans/...
└── dev/
    ├── supabase-setup.md
    ├── vercel-deploy.md
    └── dual-device-test.md

package.json
vite.config.ts
tailwind.config.js
postcss.config.js
tsconfig.json
.env.example  # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
.gitignore
README.md
```

### 5.3 实时同步实现

```tsx
// hooks/useItems.ts
export function useItems(listId: string | null) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!listId) return;
    // Initial fetch
    supabase.from('items').select('*').eq('list_id', listId).order('created_at')
      .then(({ data }) => data && setItems(data));

    // Realtime subscription
    const channel = supabase.channel(`items:${listId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'items',
        filter: `list_id=eq.${listId}`
      }, (payload) => {
        setItems(curr => applyChange(curr, payload));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [listId]);

  return items;
}
```

### 5.4 部署路径

1. 注册 [supabase.com](https://supabase.com)（GitHub 登录，免费）
2. 创建 Project → 跑 `supabase/migrations/001_initial_schema.sql` 建表 + RLS
3. 在 Supabase Dashboard → Authentication → Providers → 启用 **Anonymous Sign-ins**
4. 复制 Project URL 和 anon key 到 `.env` 本地测
5. 注册 [vercel.com](https://vercel.com)（GitHub 登录，免费）
6. 连接 GitHub repo `bellaaaaxu/MaiSha` → 自动部署
7. 在 Vercel 项目设置里填环境变量 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
8. 拿到默认域名 `maisha.vercel.app`（或 `maisha-bellaxu.vercel.app` 类似）

### 5.5 中国访问性能

- Vercel Edge CDN 中国大陆访问通常可用（时延 200-500ms，偶有抖动）
- Supabase 默认 Singapore region，中国访问 100-300ms，稳定
- 若 Vercel 被墙：**备选 Cloudflare Pages**（同一个 repo 换个部署目标），或腾讯云/阿里云静态托管
- 用户已在中国境内；微信内置浏览器可访问 Vercel 域名

### 5.6 限制与注意

- 匿名 token 存 localStorage → 清浏览器数据 = 失去对清单的访问权（需老公再发一次链接回来加入）
- Supabase 免费版：500MB 数据库、500K 行、2GB 带宽/月 → 2 人使用绰绰有余
- Vercel 免费版：100GB 带宽/月 → 家用绰绰有余
- iOS Safari 的 PWA 安装体验略逊 Android，但基本功能完好

---

## 6. 开发路径（3 周）

比原 4 周节奏压缩：省了微信审核 + 云函数部署 + 真机双端联调（浏览器即时预览）。

| 周 | 阶段 | 内容 | 验收 |
|---|---|---|---|
| **W1** | 脚手架 + 纯工具 + UI 骨架 | Vite+React+Tailwind 项目、4 个 utils（TDD）、UI 组件（ItemRow, SupermarketCard, AddSheet, Chip）、主清单页渲染 mock 数据 | 浏览器跑主页面，mock 数据分组正确；Vitest 全绿 |
| **W2** | Supabase 集成 + CRUD + 实时 | Supabase 项目、schema + RLS、匿名 auth、db.ts、useList/useItems hook、添加/勾选/编辑/删除/清空/管理超市全流程 | 单端 CRUD 全通 + 两个浏览器窗口实时同步 |
| **W3** | PWA + 分享 + 部署 + 打磨 | Vite PWA 插件、manifest/icons、分享链接、加入 list 流程、Vercel 部署、真机（iOS+Android）测试 | 真机装 PWA 到主屏幕 + 老公手机打开链接加入 |

---

## 7. v2 / v3 路线图（仅作预留）

### v2: 库存 + 过期提醒（+3 周）

- 新增 `inventory` 表：`{list_id, name, note, purchased_at, expires_at, photo_url, category, consumed_at}`
- 勾选购物清单物品时弹"入库存"选项 → 调 `<input type="file" accept="image/*" capture>` 拍生产日期 → 上传 Supabase Storage
- 添加 Supabase Edge Function 定时任务检查临期库存 → 用 Web Push API 推送（用户需授权浏览器通知）
- 新增"库存"Tab，按到期日排序

### v3: 菜谱 + 菜单规划（+3 周）

- `recipes` 表 + `meal_plans` 表
- 菜谱录入 / 排周菜单 / 差额自动入购物清单

### v∞: 原生 APP（可选）

使用 **Capacitor.js** 包装现有 PWA 代码：
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npx cap add android
npx cap build ios
```
生成的 iOS / Android 项目可上 App Store / Google Play / 国内安卓市场。**零前端代码重写**。

---

## 8. 待办 / 开放问题

已确认：
- [x] 前端框架：**React + TypeScript**
- [x] 后端：**Supabase**
- [x] 身份识别：**URL 分享链接 + Supabase Anonymous Auth**
- [x] 开发语言：TypeScript

待实现阶段确认的小问题（不阻塞设计审核）：
- [ ] Supabase project 创建（用户注册后给 Project URL + anon key）
- [ ] 自定义域名？（可选。Vercel 默认子域名免费够用）
- [ ] PWA 图标素材（用户提供一张 1024×1024 原图，或我用文字+emoji生成简易版）
- [ ] 国内访问保障（万一 Vercel 不稳再迁 Cloudflare Pages，v1 不提前做）

---

## 9. 验收标准（v1 上线条件）

- [ ] 两个浏览器会话能通过 URL 邀请加入同一清单
- [ ] 清单按超市分组显示，超市内按品类副分组
- [ ] 能添加 / 编辑 / 删除 / 勾选 / 取消勾选物品
- [ ] 任一端操作，另一端 3 秒内看到变化（Supabase Realtime）
- [ ] "常买" 和 "最近添加" chips 显示正确
- [ ] 邀请流程：复制链接 → 发微信 → 对方点开 → 自动加入
- [ ] 超市可自定义增删改
- [ ] 清空已购原子执行
- [ ] PWA 可"添加到主屏幕"并显示图标 + 启动画面
- [ ] Vitest 全绿（4 个 utils 测试）
- [ ] 真机（iOS Safari + Android Chrome + 微信内置浏览器）全交互流畅
