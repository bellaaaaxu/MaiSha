# MaiSha 路线图

> 一页纸看到「做过什么 / 在做什么 / 待办 / 推后」。功能聚合，不复刻 commit。
> 最近更新：2026-06-04

---

## 项目定位简述

MaiSha（买啥）是面向华人家庭的轻量共享购物清单 iOS/PWA 应用，完全免费、零注册，扫码即协作。目标用户是管采购的一方（规划）+ 到店执行的一方（打勾），按超市分组，中餐食材为主。阶段目标：v1 上架 iOS App Store，积累首批真心喜欢的用户。

---

## ✅ 已上线（按时间倒序）

### 🆕 多清单 UX v1（2026-06-04 落地）

一个账号下可创建多个清单（旅行、聚会、年货 + 长期家用）；三段状态 `pinned / active / archived`，全手动；左滑展开操作、长按弹面板、头部两颗水彩切换图标（占位 SVG，待替换）。单清单用户零感知。

- spec: [superpowers/specs/2026-06-04-multi-list-ux-design.md](superpowers/specs/2026-06-04-multi-list-ux-design.md)
- plan: [superpowers/plans/2026-06-04-multi-list-ux-v1.md](superpowers/plans/2026-06-04-multi-list-ux-v1.md)
- migration 012 已应用（`state` / `pin_order` 两列 + 受保护 RPC）
- pending: 浏览器 11 项冒烟 + 手绘水彩图标替换占位 SVG

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

- **多清单 UX v1 冒烟验证** — 浏览器 11 项端到端冒烟测试待完成（2026-06-04 计划中）

---

## 📋 待办（v1 上架前必做）

- **新手引导（onboarding tour）** — app 各 tab / 核心功能的首次使用引导；创建 / 导入清单的操作提示；2026-06-04 浏览器冒烟时用户提出，上架前必须完成；待 brainstorm。
- **手绘水彩图标替换占位 SVG** — 多清单切换器（一叠卡片）+ 发送按钮（纸飞机）两枚；512×512 高分辨率，经 sharp 压成 84×84 WebP；用户来画，压缩脚本已有现成模式（compress-icons.mjs）。
- **iOS App Store 提交流程** — 截图（iPhone 15 Pro / iPad）、隐私权限描述、构建上传、审核提交；spec 草案已在 [superpowers/specs/2026-05-24-app-store-optimization-design.md](superpowers/specs/2026-05-24-app-store-optimization-design.md)。
- **端到端冒烟（真机）** — 多清单 v1 在 iOS Safari + 安装为 PWA 后的完整操作路径验证（创建清单 → 切换 → 归档 → 恢复）。
- **Recovery code 展示打磨** — 当前 recovery code 仅在 Settings 露出，上架前确认曝光时机和文案对新用户足够清晰。

---

## 🗺️ 路线图（已规划但推后）

- **账号化图标库 v2 实时同步** — 家人新添加图标无需刷新即可在所有设备见到；与多清单实时同步一同考虑
- **多清单实时同步** — 多设备同时打开时清单列表变化实时推送（v1 接受手动刷新）
- **数据恢复 Phase 2** — iOS iCloud KVS 自动存储 recovery token，无感找回，不需要用户手动抄 recovery code
- **收藏品（集印章 / 猫）** — 完成清单解锁 stamp / 猫咪，手账日记风收集；onboarding 稳定后单独 brainstorm
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
- memory files: `.claude/projects/…/memory/`
- repo: GitHub `bellaaaaxu/MaiSha`
