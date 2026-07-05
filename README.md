# 买啥 MaiSha

> 一个人的买菜手账 + 家庭共享清单。完全免费、零注册；按店记录、到店打勾不漏买；
> 链接发给家人，点开即一起勾。暖色手账风 + 手绘水彩图标。
> React PWA + Capacitor 封装，目标 iOS App Store 上架（首发滩头：北美华人家庭）。

**项目进展与全部设计索引 → [docs/ROADMAP.md](docs/ROADMAP.md)**（一页纸：已上线 / 进行中 / 待办 / 推后）
**产品宪法（定位、设计哲学、图标体系、市场研判）→ [docs/project-design.md](docs/project-design.md)**

---

## 特性

### 清单与共享
- 🏪 **按店铺分组**：T&T / 大统华 / Costco……自定义店铺，扁平分组
- 📚 **多清单**：旅行、聚会、年货 + 长期家用；置顶 / 活跃 / 归档三段状态
- 👫 **家庭实时共享**：Supabase Realtime；复制链接或短邀请码，对方点开即加入，零注册
- 🔑 **账号找回**：轻量账号锚点 + 找回码，清缓存/换设备不丢数据
- 📲 **PWA 可安装 + 离线**：离线操作进队列，恢复网络自动同步；新版本自动提醒
- 🌐 **三语 i18n**：简中 / 繁中 / English，onboarding 选定、随时可换
- 💬 **微信引导条**：微信内打开时引导跳转浏览器（webview 身份分裂对策）

### 添加与图标
- 🎨 **水彩手绘图标**：277 个预设食材/日用图标（Gemini 批量生成 + sharp/WebP 压缩）
- 🤖 **AI 生成图标**：预设没有的物品可现场 AI 生成（Edge Function → Gemini），全局限额
- 🗂️ **账号图标库**：AI 图标归属账号、家人并集共享，可从「全家图库」借用
- 🔁 **批量添加 / 文本导入**：sheet 连续添加；粘贴一段文字自动拆条导入

### 采购
- 🛍️ **购物模式**：进店逐项打勾、进度条、一键完成采购
- 📜 **采购历史**：每次采购留档，可回看、可删
- 🖐️ **长按拖拽换店**："白菜我在元初买了，拖过去"
- ↩️ **Undo Toast**：删除/勾选 5 秒可撤销，无原生弹窗
- 📍 **查超市（v1 招牌）**：输入商品 → AI 映射店类型 → 原生 MapKit 搜附近门店 → 一键落进清单（iOS 独占）

---

## 技术栈

- **前端**：React 18 + TypeScript + Vite + react-router
- **样式**：Tailwind CSS + inline style（暖色手账风，WashiTape / 水彩组件）
- **i18n**：i18next（zh-CN / zh-TW / en）
- **后端**：Supabase（Postgres + Realtime + Anonymous Auth + RLS + Edge Functions + Storage），migration 001–014
- **原生封装**：Capacitor 8（iOS / Android），查超市走自写 Swift `MKLocalSearch` 插件
- **监控**：Sentry（errors-only，仅生产）+ 自建 events 埋点表（北极星 / 周活 / W1·W4 留存视图）
- **拖拽**：@dnd-kit（移动端触摸友好）
- **PWA**：vite-plugin-pwa（manifest + service worker + 更新提示）
- **测试**：Vitest + Testing Library（159 单测 / 32 文件）
- **部署**：Cloudflare Workers + Static Assets（GitHub 推送自动部署）

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置 .env
cp .env.example .env
# 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
# （见 docs/dev/supabase-setup.md）

# 3. 运行
npm run dev           # dev server (http://localhost:5173)
npm test              # vitest 单测
npm run typecheck     # tsc --noEmit
npm run build         # 生产构建

# iOS / Android（原生构建需 Mac + Xcode）
npm run cap:build     # build + cap sync
npm run cap:open:ios  # 打开 Xcode 工程
```

### 开发用页面
- `/list` — 主清单页
- `/icon-preview` — 图标库预览（不需要登录）

### 常用脚本（`scripts/`）
- `generate-item-icons.mjs` — Gemini 批量生成预设图标
- `compress-icons.mjs` / `compress-ui-icons.mjs` — sharp + WebP q85 压缩（**所有 `public/` 视觉资产必须先过这一步**，PWA precache 有 2 MiB 上限）
- `seed-store-types.mjs` — 查超市 `store_type_hints` 预填种子

---

## 首次配置

1. [Supabase 配置](docs/dev/supabase-setup.md) — 建 project、跑 migration、启用匿名登录和 Realtime
2. [Cloudflare 部署](docs/dev/cloudflare-deploy.md) — 一键连 GitHub 自动部署

---

## 文档地图

| 文档 | 用途 |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | **进度总览**：已上线 / 进行中 / 待办 / 推后，每条挂 spec/plan 链接 |
| [docs/project-design.md](docs/project-design.md) | **项目宪法**：定位叙事金字塔、设计哲学、图标体系与吉祥物（§8）、市场研判（§9） |
| `docs/superpowers/specs/` | 18 份功能 spec（按日期命名，ROADMAP 有索引） |
| `docs/superpowers/plans/` | 12 份实施计划 |
| [docs/dev/](docs/dev) | Supabase / Cloudflare 环境搭建 |
| [icon-prompts.md](icon-prompts.md) | 图标 Gemini 生成 prompt 目录 |

---

## 当前状态（2026-07-04）

- ✅ 核心循环全部在线：多清单、共享加入、账号找回、图标库、购物模式、历史、离线、三语、埋点 + Sentry（生产已验证）
- 🚧 **上架冲刺**：查超市代码已合并、云端已部署，剩 Xcode target 挂载 + iOS 真机冒烟（需 Mac）；随后 App Store 截图 / 元数据提交（三语文案已定稿）
- 📋 上架后验证：北美华人家庭种子用户裂变假设、W1/W4 留存
- 🎨 进行中素材：吉祥物「小榕包」定妆照已入库（`docs/brand/`），食物小人班底原图在 `mascot-staging/`（未跟踪，待压缩 + hash 分配引擎实现）

完整版见 [docs/ROADMAP.md](docs/ROADMAP.md)。

---

## License

Private. 个人项目。
