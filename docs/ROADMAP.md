# MaiSha 路线图

> 一页纸看到「做过什么 / 在做什么 / 待办 / 推后」。功能聚合，不复刻 commit。
> 最近更新：2026-07-02

---

## 项目定位简述

MaiSha（买啥）是**一个人的买菜手账 + 家庭共享清单**：完全免费、零注册；按店记录、到店打勾不漏买；链接发给家人，点开即一起勾。首发滩头为北美华人家庭——获客层显性打「华人超市」场景，产品层保持普适（叙事金字塔见 [统一叙事 spec](superpowers/specs/2026-07-02-unified-narrative-design.md)）。阶段目标：v1 上架 iOS App Store，用 W1/W4 周留存验证核心循环。

> 市场研判（2026-06，详见 [project-design.md](project-design.md) §9）：**北美/加拿大华人是更现实的首发滩头**；护城河是「中餐 + 华人 + 微信零摩擦」niche；买啥是**规划层**（≠ Weee!/配送的履约层）；品类高流失，**留存是生死线**。

---

## ✅ 已上线（按时间倒序）

### 🆕 头部手绘水彩图标上线（2026-07-03 落地）

用户手绘三枚（多清单切换器一叠卡片 / 分享纸飞机 / 刷新墨绿圆箭头）替换头部占位 SVG。新增 `scripts/compress-ui-icons.mjs`：**边缘 flood-fill 只抠与画布边界连通的白底**——线稿包住的内部留白全保留（纸飞机米白机身完好、刷新环中心洞经缺口正确穿透）；2048² PNG → 128² WebP q85（约 4MB → 3–5KB/枚），输出 `public/ui/`，进 PWA precache。三组件换 `<img>` 实现、Props API 不变，调用点零改动。159 测试全过，preview 实测三枚 22px 加载与透明正确。

### 微信引导条 + 店铺快选 chips + 新用户示例清单（2026-07-03 落地）

三件「第一次接触」体验打包：① **微信引导条**（方案 A，经 mockup 确认）——微信 UA 内所有页面常驻暖色细条（不挡内容故不可关），点击弹全屏指引（右上角 ⋯ → 浏览器/Safari 打开），身份分裂的最小对策，检测复用埋点的 `uaEnv`；② **店铺快选 chips**——onboarding 店铺步骤按界面语言三套各 8 个（北美中超优先，大陆/台湾混编），点选即加、再点移除，`StorePicker` 增可选 `suggestions` prop（NewListSheet 不受影响）；③ **新用户示例清单**——`getOrCreatePrimaryList` 注入 3 件真商品（鸡蛋/牛奶/西红柿三语种子，首件带「点圆圈打勾」备注），邀请加入者绝不注入；**副作用加分**：itemCount≥3 让找回码卡片对新用户立即曝光。159 测试全过（+10），preview 实测 chips toggle 与示例注入。

- spec: [superpowers/specs/2026-07-03-wechat-chips-example-design.md](superpowers/specs/2026-07-03-wechat-chips-example-design.md)
- 决定记录：多步 onboarding tour **不做**——示例清单即新手引导的答案（完成率与维护成本考量）

### 留存埋点 + Sentry 错误监控（2026-07-03 生产验证通过）

上架前的「眼睛」全链路在线：`events` 表（migration 014：RLS 只进不出 + `env` 列隔离 dev/prod）+ 三个分析视图（北极星=每周完成采购的清单数 / 周活 / W1·W4 留存 cohort，仅统计 prod）；五个核心事件接线（`add_item` / `complete_trip` / `share_link_open`〔ua_env 识别微信 webview〕/ `list_join` / `store_finder_used`）；Sentry errors-only 仅生产初始化；隐私政策页同步（含修正「不追踪地理位置」失实条目）。**生产验证 2026-07-03**：Sentry 实收测试 issue ✓、events 表实见 `env='prod'` 行 ✓。周查数 SQL 手册在 spec §7。

- spec: [superpowers/specs/2026-07-03-analytics-sentry-design.md](superpowers/specs/2026-07-03-analytics-sentry-design.md)
- 部署备忘：迁移历史已 repair（001–012 标记 applied，今后 `db push` 常规可用）；**Workers Build 变量踩坑**——新增构建变量后 Retry deployment 不生效，须 push 触发全新构建。

### 设置区死链修复 + 抽屉成为设置中枢（2026-07-02 落地）

修复上架阻塞 bug：抽屉「语言设置」「导入 / 导出」原指向不存在的路由（被 `*` 静默弹回 /list——**上完 onboarding 改不了语言**）。语言设置改为抽屉内水彩弹层（LanguageSheet，选完即生效、`maisha:language` 自动持久化）；「导入 / 导出」拆为「导入文本」（接现有 ImportSheet）+「复制清单文本」（救回孤儿导出功能）；**删除孤儿路由 /settings**（Settings.tsx 全页硬编码中文、无入口引用），抽屉补「找回码」（点击复制 + 弹层展示，解决常驻入口）与「输入邀请码加入」（救回 /join 普通模式的唯一入口）。顺带修复既有 stacking bug：ConfirmModal / NoticeModal z 提到 1100（原先从抽屉打开的确认层被抽屉背板盖住）。145 测试全过（LanguageSheet ×2 新增），浏览器实测语言切换/持久化、导出、找回码、邀请码、/settings 兜底全部路径。

- spec: [superpowers/specs/2026-07-02-settings-dead-links-design.md](superpowers/specs/2026-07-02-settings-dead-links-design.md)

### 分享/确认弹层去原生化（2026-07-02 落地）

新增 `NoticeModal`（ConfirmModal 视觉同款、单按钮、正文可选中可换行——兜底场景用户可长按手动复制），分享/确认主链路全部摘掉原生 `alert`/`prompt`/`confirm`：List 头部分享（成功 + 剪贴板被拒兜底）、MyLists 长按面板的分享/删除（删除改用 ConfirmModal）/重命名校验/错误提示、SettingsDrawer 清空失败提示。新增 i18n key：`common.ok`、`settings.clearFailed`（三语）。143 单测全过（NoticeModal ×3），浏览器实测分享成功/兜底/长按面板三条路径。

- 顺带发现两个问题：**SettingsDrawer 语言设置/导入导出是死链**（见待办，上架阻塞级）；`/settings` 是无入口孤儿路由（Settings.tsx 全页硬编码中文，未做无用装修，处置见同一待办条目）。

### 统一产品叙事（2026-07-02 文档层落地）

三处叙事分裂（宪法「双人共享」/ repositioning「Global 个人优先」/ §9「北美华人滩头」）统一为叙事金字塔：**L1 个人手账 → L2 家庭放大 → L3 华人深度（获客显性、产品普适）**。宪法 §1 与本页定位简述已重写；App Store 三语元数据草案定稿在 spec 附录 C；app 内文案已落地（2026-07-02）：onboarding slogan + 分享文案——落地时发现 `share.*` 是死 key、三处分享入口硬编码中文（含「发给老公」旧文案），已抽 `invite-text` util 统一接 i18n，140 单测 + 浏览器实测通过。

- spec: [superpowers/specs/2026-07-02-unified-narrative-design.md](superpowers/specs/2026-07-02-unified-narrative-design.md)

### 多清单 UX v1（2026-06-04 落地）

一个账号下可创建多个清单（旅行、聚会、年货 + 长期家用）；三段状态 `pinned / active / archived`，全手动；左滑展开操作、长按弹面板、头部两颗水彩切换图标（占位 SVG，待替换）。单清单用户零感知。

- spec: [superpowers/specs/2026-06-04-multi-list-ux-design.md](superpowers/specs/2026-06-04-multi-list-ux-design.md)
- plan: [superpowers/plans/2026-06-04-multi-list-ux-v1.md](superpowers/plans/2026-06-04-multi-list-ux-v1.md)
- migration 012 已应用（`state` / `pin_order` 两列 + 受保护 RPC）
- pending: 浏览器 11 项冒烟 + 手绘水彩图标替换占位 SVG
- 2026-06-04 用户冒烟反馈 hotfix：始终「买啥」title + washi tape 「当前 · 家里」副标题 + ListRow 移除 [当前] tag（修复左滑重叠）
- 2026-06-04 用户冒烟反馈 hotfix #2：当前清单行背景从 rgba(.10) 改为不透明 #f9efe6，并加 zIndex:1（修复动作按钮透显 + 点击穿透到 /list 的 bug）
- 2026-06-04 新增 PWA 手动刷新按钮：头部加水彩 ↻ 图标（占位 SVG，可后续手绘），点击 = `window.location.reload()`，三语 i18n `header.refresh`

### 账号化图标库 v1 + v1.1（2026-06-02 / 2026-06-03 落地）

v1：每个账号拥有独立图标库（`icon_library` 表），同家人并集 RPC 共享；AI 生成写入账号库，全局 100/天软限 + graduated 配额（成熟账号 5/天）；简繁归一化（一张小词表）。v1.1：AddSheet 加「从全家图库借用」复用选择器（写入指派层），图标库页加搜索框；迁移 011 暴露并集图标 id。

- spec v1: [superpowers/specs/2026-05-31-account-icon-library-design.md](superpowers/specs/2026-05-31-account-icon-library-design.md)
- spec v1.1: [superpowers/specs/2026-06-03-icon-reuse-selector-design.md](superpowers/specs/2026-06-03-icon-reuse-selector-design.md)
- plan v1: [superpowers/plans/2026-06-02-account-icon-library-v1-foundation.md](superpowers/plans/2026-06-02-account-icon-library-v1-foundation.md)
- plan v1.1: [superpowers/plans/2026-06-03-icon-reuse-selector-v1.1.md](superpowers/plans/2026-06-03-icon-reuse-selector-v1.1.md)
- migrations 010 + 011 已应用；Edge 已部署

### 数据持久化与账号恢复 Phase 1（2026-05-29 落地）

解决「清缓存 = 数据彻底消失」架构性风险。引入轻量 `accounts` 实体作恢复锚点（不破坏零注册）；`resolveActiveContext` 优先从账号找回活跃清单；Settings 页展示 recovery code；JoinByCode 增加 recover 模式；新用户 3+ 件物品后提示保存 recovery code。

- spec: [superpowers/specs/2026-05-28-data-persistence-recovery-design.md](superpowers/specs/2026-05-28-data-persistence-recovery-design.md)
- plan: [superpowers/plans/2026-05-28-data-persistence-recovery-phase1.md](superpowers/plans/2026-05-28-data-persistence-recovery-phase1.md)
- migration 009 已应用；2026-05-29 冒烟通过

### Onboarding 重新设计（2026-05-28 落地）

三步 onboarding（语言 → 店铺 → 货币）全面改用手账风视觉：WashiTape 装饰组件、Wordmark（hero/mini）、botanical 庆祝动画、safe-area 修复。zh-TW 同步重写为标准繁中。

- spec: [superpowers/specs/2026-05-28-onboarding-redesign-design.md](superpowers/specs/2026-05-28-onboarding-redesign-design.md)
- plan: [superpowers/plans/2026-05-28-onboarding-redesign.md](superpowers/plans/2026-05-28-onboarding-redesign.md)

### 图标资产与 AI 生成（2026-05-20 起，持续迭代至 2026-06-03）

AI 图标生成：Supabase Edge Function → Gemini 2.5 Flash Image API，生成后存 Supabase Storage，PWA CacheFirst 缓存。本地预设图标目录从 77 → 131 → 245 → 276 件（分批：蔬菜/生鲜/烘焙 → 酱料/调料 → 日用/个护）；所有资产经 sharp + WebP q85 压缩（268MB → ~3MB）入 PWA precache。AddSheet 图标选择面板（上传 / AI 生成 / 跳过），长按放大预览。

- spec: [superpowers/specs/2026-05-19-custom-items-design.md](superpowers/specs/2026-05-19-custom-items-design.md)
- plan: [superpowers/plans/2026-05-20-custom-items-plan.md](superpowers/plans/2026-05-20-custom-items-plan.md)

### UI 打磨：购物历史 / 清空清单 / 表头去拥挤（2026-05-27 落地）

采购历史管理模式（单选 / 多选 / 全清）；Settings 抽屉加「清空清单」入口；设置图标移到左侧汉堡避免与「一起买」误触。

- spec: [superpowers/specs/2026-05-27-history-clear-list-clear-header-design.md](superpowers/specs/2026-05-27-history-clear-list-clear-header-design.md)
- plan: [superpowers/plans/2026-05-27-history-clear-list-clear-header.md](superpowers/plans/2026-05-27-history-clear-list-clear-header.md)

### 产品重新定位（2026-05-25 落地）

从「华人家庭清单」重新定位为「个人优先，分享为加分」；移除分类体系，改为扁平化按店铺分组；推出手账日记风视觉系统（StoreCard / 字体 / CSS 变量）；引入 i18n（zh-CN / zh-TW / en 三语）。

- spec: [superpowers/specs/2026-05-25-repositioning-design.md](superpowers/specs/2026-05-25-repositioning-design.md)
- plan: [superpowers/plans/2026-05-25-repositioning-plan.md](superpowers/plans/2026-05-25-repositioning-plan.md)

### Undo Toast / 离线队列 / 文本导入（2026-05-24 落地）

删除和勾选操作从 `confirm()` 改为底部 undo toast（5 秒撤销）；文本批量导入（逗号/换行分割）；购物模式进度条 + 结束弹窗 + 采购历史保存；「顺路推荐」面板（显示未分配商店的物品）；PWA 更新提示。

- spec: [superpowers/specs/2026-05-24-undo-offline-import-design.md](superpowers/specs/2026-05-24-undo-offline-import-design.md)

### App Store 准备 + Capacitor（2026-05-24 落地）

Capacitor 封装 iOS/Android；隐私政策页；App 图标生成（iOS / Android / PWA 多尺寸）；Open Graph + Twitter Card；短邀请码（类 Discord）分享。

- spec: [superpowers/specs/2026-05-24-app-store-optimization-design.md](superpowers/specs/2026-05-24-app-store-optimization-design.md)
- plan: [superpowers/plans/2026-05-24-app-store-optimization.md](superpowers/plans/2026-05-24-app-store-optimization.md)

### UI 头部重设计 + 图标库页面（2026-05-20 落地）

主界面头部从「⋯」菜单改为三颗可见图标按钮（🎨图标库 / 📤分享 / ⚙设置）；新增独立图标库页（创建/重生成/删除）；图标长按放大预览（防误触）。

- spec: [superpowers/specs/2026-05-20-ui-improvements-design.md](superpowers/specs/2026-05-20-ui-improvements-design.md)
- plan: [superpowers/plans/2026-05-20-custom-items-plan.md](superpowers/plans/2026-05-20-custom-items-plan.md)

### 核心清单功能 v1（2026-04-22 / 2026-04-23 落地）

从 WeChat 小程序 pivot 到 React PWA + Supabase；匿名 session、Realtime 实时同步、RLS 权限；按超市二级分组；AddSheet 物品快速添加（preset 图标、频繁购买推荐）；拖拽跨商店移动；EditItem / ManageMarkets / Settings 路由；Cloudflare Pages 部署。

- spec: [superpowers/specs/2026-04-23-maisha-design.md](superpowers/specs/2026-04-23-maisha-design.md)
- plan: [superpowers/plans/2026-04-23-maisha-v1.md](superpowers/plans/2026-04-23-maisha-v1.md)

---

## 🚧 进行中

- **查超市 store-finder v1 — 代码已实现并合并（2026-06-17）** — 反向入口：输入商品 → AI 映射店类型（Gemini 文本 + `store_type_hints` 共享缓存 + 276 预填脚本）→ 原生 MapKit `MKLocalSearch` 搜附近（iOS 独占，国内走高德/北美走 Apple，免费）→ 一键把店+商品落进清单。单元 A–E 全部完成，136 单测通过、typecheck/build 干净，每单元经 spec + 代码质量双审。
  - spec: [superpowers/specs/2026-06-14-store-finder-design.md](superpowers/specs/2026-06-14-store-finder-design.md) · plan: [superpowers/plans/2026-06-14-store-finder.md](superpowers/plans/2026-06-14-store-finder.md)
  - 2026-07-03 云端部署**全部完成**：① migration 013 已 push ✓ ② edge function `resolve-store-types` 已部署 ✓ ③ seed 已跑完 ✓——277/277 处理、`store_type_hints` 入库 276 行（source='seed'，中英双语 tier1–3），抽查「生抽」结构正确
  - **剩余（需 Mac，最后两步）**：④ Xcode 把 `StoreSearch.swift`+`.m` 加入 App target → ⌘B 编译 ⑤ iOS 真机端到端冒烟（plan Task 16，注意验 `MKLocalSearch` 漏返）
- **多清单 UX v1 冒烟验证** — 浏览器 11 项端到端冒烟测试待完成（2026-06-04 计划中）

---

## 📋 待办（v1 上架前必做）

- **iOS App Store 提交流程** — 截图（iPhone 15 Pro / iPad）、隐私权限描述、构建上传、审核提交；spec 草案已在 [superpowers/specs/2026-05-24-app-store-optimization-design.md](superpowers/specs/2026-05-24-app-store-optimization-design.md)；名称/副标题/关键词/描述/截图五帧叙事三语草案已定稿在 [统一叙事 spec](superpowers/specs/2026-07-02-unified-narrative-design.md) 附录 C。
- **端到端冒烟（真机）** — 多清单 v1 在 iOS Safari + 安装为 PWA 后的完整操作路径验证（创建清单 → 切换 → 归档 → 恢复）。
- **Recovery code 展示打磨** — 常驻入口已解决（2026-07-02：抽屉「找回码」项）；首曝时机已顺带解决（2026-07-03：示例清单使新用户 itemCount≥3，找回码卡片立即出现）；剩余：卡片可永久 dismiss 的文案清晰度，上架前过一眼即可。
- **微信分享假设验证** — 找 5–10 户北美华人家庭，验证「发链接 → 点开即加入」裂变是否真成立（§9.6：一代华人微信占主导、二代偏 iMessage/SMS；但分享本就「发链接」渠道无关，真正要验的是「是否会用手机协调买菜」这个行为）。前置的微信引导条最小版已上线（2026-07-03），种子验证可以开跑；完整身份迁移在路线图 v1.1。
- **吉祥物「小榕包」+ 食物小人班底（长尾图标体系）** — 设计已定（[project-design.md](project-design.md) §8）：队长小笼包「小榕包」+ 约 30 只中国各地美食图鉴；待 Gemini 出图 + 实现 `hash(商品名)→班底` 分配逻辑。生鲜仍走专属写实水彩。
- **查超市 store-finder（v1 招牌）** — 用户 2026-06-14 定为 v1 招牌功能。**代码已实现并合并（2026-06-17，见「进行中」）**；剩部署 + iOS 真机冒烟。唯一原生 Swift + 定位权限、最不确定，**排首发线最后一棒，若临门卡住降级为 v1.1**（见 [project-design.md](project-design.md) §9.5）。冒烟须验证 `MKLocalSearch` 漏返（API 可能返回比 Maps app 少的店，Apple 已知问题，§9.6）。

---

## 🗺️ 路线图（已规划但推后）

- **账号化图标库 v2 实时同步** — 家人新添加图标无需刷新即可在所有设备见到；与多清单实时同步一同考虑
- **多清单实时同步** — 多设备同时打开时清单列表变化实时推送（v1 接受手动刷新）
- **数据恢复 Phase 2** — iOS iCloud KVS 自动存储 recovery token，无感找回，不需要用户手动抄 recovery code
- **收藏品（食物小人图鉴）** — 完成清单解锁食物小人班底（[project-design.md](project-design.md) §8）里的萌物，季节限定款（青团/粽子/月饼/汤圆）作图鉴；与吉祥物共用一套资产；onboarding 稳定后单独 brainstorm
- **微信身份迁移完整版（v1.1）** — 引导条最小版已上线（2026-07-03）；剩余：邀请落地页价值前置、join/recovery code 跨 webview 身份桥接、iOS Universal Links 直接唤起 App
- **FirstOpenRedirect 渲染期副作用** — 在渲染期写 `maisha:seen`，dev StrictMode 双渲染会跳过 onboarding（生产单渲染不受影响）；把写入挪进 useEffect
- **剩余原生弹窗清扫** — 分享/确认主链路已去原生化（2026-07-02，见已上线）；其余页面仍有零散原生 alert/confirm（AddSheet 上传/替换确认、EditItem、IconLibrary、ManageStores、PurchaseHistory、ShoppingEndModal、List 拖拽报错等），MyLists 重命名仍用原生 prompt（需要输入型弹层）；统一换 NoticeModal / ConfirmModal / 新输入弹层
- **清单封面色 / 主题** — 每个清单可选 washi tape 颜色，与副标题主题联动，v2 视觉迭代
- **菜谱一键加购** — 常见中餐菜谱食材批量加入清单；spec 草案 [superpowers/specs/2026-05-11-recipes-design.md](superpowers/specs/2026-05-11-recipes-design.md)（状态：Draft，尚未进入规划队列）

---

## 💤 已搁置 / 拒绝

- **菜谱完整教学功能** — 明确不做（Paprika / 下厨房已有），仅保留「一键加购食材」方向的轻量联动
- **营养卡路里追踪** — 明确不做（Yazio / 薄荷已有）
- **社区共享菜谱库** — 菜谱 spec 中曾提及 v3 社区层；社区功能与「小而美」定位冲突，搁置
- **分类体系（CategoryKey）** — 2026-05-25 repositioning 时已移除，改为扁平店铺分组；不重新引入
- **B 端 / 商业批量采购** — 非目标用户，明确排除

---

## 链接索引

- specs: `docs/superpowers/specs/`
- plans: `docs/superpowers/plans/`
- project design: `docs/project-design.md`
- 图标体系 / 吉祥物: `docs/project-design.md` §8（食物小人班底 + 小榕包 + prompt 模板）
- 市场与竞争研判: `docs/project-design.md` §9（2026-06 数据调研）
- 查超市 spec: `docs/superpowers/specs/2026-06-14-store-finder-design.md`
- 统一叙事 spec: `docs/superpowers/specs/2026-07-02-unified-narrative-design.md`（叙事金字塔 + App Store 文案定稿）
- brand-icon 审计: `docs/brand-icon-audit.md`
- repo: GitHub [bellaaaaxu/MaiSha](https://github.com/bellaaaaxu/MaiSha)
