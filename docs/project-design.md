# 买啥 MaiSha — 项目总体设计

> 这是产品的"宪法"文档：定位、设计哲学、技术架构、演进方向。
> 按功能拆分的详细 spec 见 `docs/superpowers/specs/`。

---

## 1. 产品定位

### 一句话定位
**为中餐家庭做的轻量共享购物清单 PWA**，两个人共用一张清单，按超市分组，到店不漏买。

### 谁会用
- **主要用户**：在家管采购的人（妈妈 / 妻子），平时记"要买啥"
- **协同用户**：执行采购的人（爸爸 / 丈夫），到店打勾
- **场景共性**：双人协作、跨多家超市采购、中餐食材为主

### 不做谁
- 单人记账型购物清单（用 Notes、备忘录就行）
- 商业批量采购（B 端）
- 食谱完整教学（下厨房、Paprika 已经做得很好）
- 营养卡路里追踪（Yazio、薄荷做得很好）

---

## 2. 设计哲学

### 2.1 三个不变性

1. **零注册、零登录**
   匿名 token 自动识别身份，链接打开即用。这是核心增长机制——把链接发微信，对方点开就加入，不需要任何账号操作。

2. **按超市组织，不按时间或分类**
   购物清单 app 的失败模式是"按购物日期"或"按分类"分。真实场景是：人在某个超市，只关心**这家店要买啥**。所以主视图按超市分组，分类只作为视觉锚点（emoji）。

3. **手感优先**
   PWA 必须像原生 app。安装到主屏、全屏沉浸、滑动顺滑、点击有反馈、动画轻量。每一次点击都要有视觉确认，比如添加成功时图标弹一下、勾选时 ✓ 渐入。

### 2.2 视觉语言

**温暖日系手绘风**。不是冷淡硅谷极简风。
- 主色调：暖米色（#faf6f0）渐变背景、墨绿（#7ca982）作为 accent、棕色系（#5a4e3c）作为文字
- 食材图标：**手绘水彩风**（铅笔线稿 + 柔和上色），像高级食谱书的插画
- 圆角：大胆使用（卡片 18px、按钮 12px、sheet 顶部 24px）
- 阴影：极轻，营造纸感而非玻璃感
- 动画：弹性自然，不要机械感

视觉规则总结在 `src/index.css` 的 CSS variables 和各组件的 inline style 里。颜色不随便加新的，必要时去 `feedback_ui_style.md`（用户偏好记忆）参考。

### 2.3 交互原则

**少打字、多图形选择**
中文输入麻烦，所以食材网格 + 常买区让用户基本只需要"点"。手输框作为兜底。

**反馈即时、操作可撤销**
- 添加物品：sheet 不自动关闭，可连续添加，已添加显示 ✓
- 点已添加的食材会**删除**（toggle 行为）而不是无效操作
- 完成采购前弹确认 modal

**共享但不强制同步焦点**
两个用户可以同时操作，互相能看到对方的添加和勾选，但不强制看到对方在哪屏（不做"实时光标"）。

---

## 3. 技术架构

### 3.1 技术栈

| 层 | 选择 | 原因 |
|---|---|---|
| **前端框架** | React 18 + TypeScript + Vite | 生态、HMR、PWA 插件成熟 |
| **样式** | Tailwind + inline style | Tailwind 处理 layout，复杂主题色用 inline style 更直接 |
| **路由** | react-router-dom v6 | 标准 |
| **状态** | React useState/useEffect + Supabase 订阅 | 单清单、低复杂度，不上 Redux/Zustand |
| **数据库** | Supabase (Postgres + Realtime) | 实时订阅 + RLS + 匿名认证，免运维 |
| **认证** | Supabase Anonymous Auth | 零注册体验的核心，token 存 localStorage |
| **拖拽** | @dnd-kit/core | 移动端触摸友好，touch-action 控制好 |
| **PWA** | vite-plugin-pwa | Workbox 集成、自动 manifest、SW 更新提示 |
| **部署** | Cloudflare Workers + Static Assets | 免费 CDN、GitHub 自动部署 |
| **测试** | Vitest + Testing Library | utils 单测覆盖核心逻辑 |

### 3.2 数据流

```
┌────────────────────────────────────────────────────┐
│  Browser (PWA)                                     │
│                                                    │
│  React Components                                  │
│       ↓                                            │
│  useAuth / useList / useItems / useRecipes 等 hook │
│       ↓                                            │
│  src/lib/db.ts (Supabase client wrapper)          │
│       ↓                                            │
│  @supabase/supabase-js                             │
└────────────────────┬───────────────────────────────┘
                     │
                  HTTPS + WebSocket
                     │
┌────────────────────▼───────────────────────────────┐
│  Supabase (Cloud)                                  │
│                                                    │
│  Postgres (lists, items, recipes, ...)             │
│       ↑                                            │
│  Row Level Security (auth.uid())                   │
│       ↑                                            │
│  Realtime (postgres_changes)                       │
│  Anonymous Auth                                    │
└────────────────────────────────────────────────────┘
```

**关键设计：**
- 单向数据流：Supabase 是 source of truth，前端订阅变化更新本地 state
- 离线兜底：service worker 缓存静态资源 + Supabase 调用走 NetworkFirst 短超时
- 实时更新：每个 list 的 items 表订阅 INSERT/UPDATE/DELETE 事件，1 秒内反映到 UI

### 3.3 目录结构

```
src/
├── components/          # 纯 UI 组件
│   ├── AddSheet.tsx        # 添加物品的弹层（核心交互）
│   ├── ItemRow.tsx         # 单个物品行（含 toggle/menu/拖拽）
│   ├── SupermarketCard.tsx # 超市分组卡片
│   ├── ConfirmModal.tsx    # 通用确认弹窗
│   ├── UpdatePrompt.tsx    # PWA 新版本提示
│   └── ...
├── routes/              # 页面路由
│   ├── List.tsx            # 主清单页
│   ├── Onboarding.tsx      # 首次引导
│   ├── EditItem.tsx        # 编辑物品
│   ├── ManageMarkets.tsx   # 管理超市
│   ├── Settings.tsx        # 设置
│   └── IconPreview.tsx     # 开发用图标预览（/icon-preview）
├── hooks/               # 自定义 hook
│   ├── useAuth.ts          # 匿名身份
│   ├── useList.ts          # 当前清单
│   └── useItems.ts         # 当前清单的 items + realtime
├── lib/
│   ├── supabase.ts         # Supabase client 初始化
│   ├── auth.ts             # 匿名 sign-in
│   ├── db.ts               # 所有数据库读写
│   └── realtime.ts         # Realtime 订阅封装
├── utils/
│   ├── icon-registry.ts    # 食材-图标映射 + alias 匹配
│   ├── category-matcher.ts # 物品名 → 分类推断
│   ├── frequent-items.ts   # 常买/最近添加（localStorage）
│   ├── group-items.ts      # 按超市 + 分类组织 items
│   └── constants.ts        # 默认超市、分类定义
├── types/               # TypeScript 类型
└── App.tsx / main.tsx   # 入口
```

### 3.4 关键资产

- **图标库** `public/icons/*.png`：手绘水彩风 PNG，256x256，无背景。每个 icon 名对应 `icon-registry.ts` 中的一个或多个食材（通过 `aliases` 共享）
- **生成 prompt** `icon-prompts.md`：所有图标的 Gemini 生成提示词，保证视觉一致性

---

## 4. 功能演进

### 4.1 已发布

| 版本 | 功能 | 状态 |
|---|---|---|
| v1.0 | 共享清单 + 邀请链接 + 按超市分组 + 实时同步 + PWA | ✅ |
| v1.1 | 手绘水彩图标库（蔬菜、肉蛋、主食、调料部分） | ✅ |
| v1.2 | AddSheet 大改版：图标网格 + 分类 + 常买区 | ✅ |
| v1.3 | 点击 toggle 添加/删除 + 弹跳动画 | ✅ |
| v1.4 | 顶部超市选择器（添加前先选超市） | ✅ |
| v1.5 | PWA 新版本检测 + 刷新提示 | ✅ |

### 4.2 进行中

| 版本 | 功能 | 状态 |
|---|---|---|
| v1.6 | 完善图标库（调料、日用、烘焙、饮料剩余项） | 🚧 |

### 4.3 下一步：菜谱（v2.0）

详见 `docs/superpowers/specs/2026-05-11-recipes-design.md`。

核心是**三层架构**：
1. 官方种子库（10-15 个家常菜，开箱即用）
2. 家庭私有菜谱（fork 官方 + 自建）
3. 社区公开层（预留字段，MVP 不实现）

### 4.4 远期路线图

| 版本 | 主题 | 关键功能 |
|---|---|---|
| **v2.1** | 菜谱缩放 | 按人数自动调整食材数量 |
| **v2.2** | 周菜单规划 | 拖几个菜到周一-周日，自动汇总食材到清单 |
| **v3.0** | 库存追踪 | 标记"家里已有"、过期提醒（vs Nowaste 思路） |
| **v3.1** | 社区菜谱 | source='public' 启用、热门菜谱、举报机制 |
| **v∞** | 原生 APP | Capacitor.js 包装 iOS/Android，上架应用商店 |

---

## 5. 关键决策记录

### 5.1 为什么不用微信小程序

原本 2026-04-22 计划做微信小程序。**因为个人小程序注册要求管理员微信绑定银行卡**形成障碍，改用 React PWA + Supabase。意外收获是：PWA 跨设备（iOS/Android/桌面浏览器都能用）、迭代不需要审核、分享链接更通用。

### 5.2 为什么不用 Firebase

Supabase 的 Postgres + RLS 比 Firestore 的安全规则容易写，关系型数据更适合"items 关联 list"这种结构，Realtime 接口简单，且开源可自托管。

### 5.3 为什么不做完整账号系统

家庭场景"可信"——共享链接的人就是家人，不需要密码隔离。匿名 token 持久化即可。如果将来要做社区层（v3.1），届时再加可选的"绑定邮箱"功能保护社区身份。

### 5.4 为什么图标选水彩手绘风

主流购物 app 都用扁平 emoji 或线性图标，视觉同质化严重。水彩手绘风：
1. **情感温度**：让"买菜"这件日常琐事变得有质感
2. **品牌差异**：一眼能认出是"买啥"
3. **可扩展**：用 Gemini 按统一 prompt 生成，新食材几分钟搞定

### 5.5 为什么 AddSheet 不自动关闭

旧版每次添加一个 item，sheet 自动关闭。用户加 5 样东西要开关 5 次。改成"加完保持开启 + 已加显示 ✓"后，**用户能批量添加且看到自己加了啥**。配合"点已加的删除"形成 toggle 心智模型。

### 5.6 为什么部署到 Cloudflare 而不是 Vercel

最初用 Vercel。后来切到 Cloudflare 是因为：
1. Cloudflare 免费额度更宽松
2. Workers + Static Assets 原生 SPA 路由处理
3. 国内访问相对稳定（虽然依然有限）

---

## 6. 性能与限制

### 6.1 当前已知边界

- **单清单单成员上限**：Postgres array 字段无硬限制，但 UI 上 10+ 成员会拥挤
- **items 数量**：单个清单 100+ items 时滚动开始卡，Realtime 订阅压力增加
- **图标资产**：每个 ~30KB，60+ 图标 ≈ 2MB，service worker 全缓存，首次安装稍慢
- **Supabase 免费层**：超过 7 天无活动会暂停项目，需要重连

### 6.2 性能策略

- 图标使用 `<img>` 配 `loading="lazy"` + service worker 缓存
- AddSheet 的图标网格在打开时一次性渲染，没用虚拟列表（数量可控）
- Realtime 订阅按 list_id 过滤，不订阅整张表

---

## 7. 给协作者的速查

### 7.1 新功能怎么提

1. 在 GitHub Issues 写需求（或聊天里讨论）
2. 用 `/superpowers:brainstorming` 走完一遍设计澄清
3. 把 spec 文档写到 `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`
4. 用 `/superpowers:writing-plans` 拆实施计划
5. 按计划实现，每个 commit 跟一个步骤

### 7.2 新图标怎么加

1. 决定食材名 + icon 文件名（kebab-case）
2. 去 `icon-prompts.md` 加一段 Gemini prompt
3. 用 Gemini 生成 PNG，存到 `public/icons/<name>.png`
4. 去 `src/utils/icon-registry.ts` 加一条 `{ name, icon, category, aliases? }`
5. 如果有同义词，作为 `aliases` 加进去（不要新建独立条目）

### 7.3 重要约定

- 注释只写**为什么**不写**是什么**
- 不写 TODO / 占位代码，缺什么补什么
- 文件超 300 行考虑拆分
- 颜色用 inline style 而不是新增 Tailwind class
- 不要乱加错误处理；只在系统边界（用户输入、API 返回）验证

---

## 8. 文档导航

- 本文档：项目宪法（高层视野）
- `docs/superpowers/specs/2026-04-23-maisha-design.md`：v1 完整设计
- `docs/superpowers/specs/2026-05-11-recipes-design.md`：菜谱功能设计
- `docs/superpowers/plans/2026-04-23-maisha-v1.md`：v1 实施计划
- `docs/dev/supabase-setup.md`：Supabase 配置步骤
- `docs/dev/cloudflare-deploy.md`：部署步骤
- `icon-prompts.md`：所有图标的生成 prompt
