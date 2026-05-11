# 买啥 MaiSha

> 为中餐家庭做的轻量共享购物清单 PWA。两人实时同步，按超市分组，到店不漏买。
> 可"添加到主屏幕"像原生 APP 一样使用。

---

## 特性

### 共享与同步
- 🛒 **按超市分组**：T&T / 元初 / Costco / 未分类，可自定义
- 👫 **两人共享，实时同步**：Supabase Realtime，对方操作 1 秒内可见
- 🔗 **零注册零登录**：复制链接邀请，对方点开即加入
- 📲 **PWA 可安装**：添加到主屏幕，离线浏览已加载清单
- 🔄 **新版本自动提醒**：检测到新部署时弹"刷新"提示

### 添加物品
- 🎨 **水彩手绘图标库**：60+ 食材手绘水彩插画，告别 emoji 同质化
- 🎯 **点击 toggle 添加/删除**：点第一下添加（✓ 标记），点第二下删除
- 🏪 **添加前选超市**：sheet 顶部选超市，后续添加都进这家
- 🔁 **批量添加**：sheet 不自动关闭，可连续添加多个物品
- ⌨️ **手输兜底**：图标里没有的可以打字添加，自动归类

### 清单操作
- 🖐️ **长按拖拽换超市**："白菜我在元初买了，拖过去"
- ✅ **轻点勾选/取消**：勾选后划线变灰
- 🛍️ **一键完成采购**：清掉所有已勾选，未勾选保留
- 📋 **导出纯文本**：给不用 app 的家人发微信

---

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **样式**：Tailwind CSS + inline style（暖色系日系手绘风）
- **后端**：Supabase（Postgres + Realtime + Anonymous Auth + RLS）
- **拖拽**：@dnd-kit/core（移动端触摸友好）
- **PWA**：vite-plugin-pwa（manifest + service worker + 更新提示）
- **测试**：Vitest + Testing Library（utils 单测）
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
```

### 开发用页面
- `/list` — 主清单页
- `/icon-preview` — 图标库预览（不需要登录）

---

## 首次配置

1. [Supabase 配置](docs/dev/supabase-setup.md) — 建 project、跑 migration、启用匿名登录和 Realtime
2. [Cloudflare 部署](docs/dev/cloudflare-deploy.md) — 一键连 GitHub 自动部署

---

## 添加新图标

完整流程在 [project-design.md §7.2](docs/project-design.md#72-新图标怎么加)，简版：

1. 决定食材名和 icon 文件名（kebab-case）
2. 在 `icon-prompts.md` 写一段 Gemini 生成 prompt
3. 生成 PNG 存到 `public/icons/<name>.png`
4. 在 `src/utils/icon-registry.ts` 加条目；同义词作为 `aliases`

---

## 文档

| 文档 | 用途 |
|---|---|
| [project-design.md](docs/project-design.md) | 项目宪法：定位、设计哲学、技术架构 |
| [v1 设计文档](docs/superpowers/specs/2026-04-23-maisha-design.md) | v1 完整 spec |
| [菜谱功能设计](docs/superpowers/specs/2026-05-11-recipes-design.md) | v2.0 菜谱 spec |
| [v1 实施计划](docs/superpowers/plans/2026-04-23-maisha-v1.md) | v1 step-by-step |
| [Supabase 配置](docs/dev/supabase-setup.md) | 从零搭建后端 |
| [Cloudflare 部署](docs/dev/cloudflare-deploy.md) | 部署到生产 |
| [icon-prompts.md](icon-prompts.md) | 所有图标的 Gemini 生成 prompt |

---

## 路线图

- ✅ **v1.x** — 购物清单 + 分享邀请 + PWA + 拖拽换超市 + 水彩图标库 + toggle 添加
- 🚧 **v2.0** — 菜谱功能（官方种子库 + 家庭 fork 定制）
- ⏸️ **v2.1+** — 菜谱按人数缩放、周菜单规划
- ⏸️ **v3** — 库存追踪 + 过期提醒、社区菜谱
- ⏸️ **v∞** — Capacitor.js 包装为 iOS/Android 原生 APP

详见 [project-design.md §4 功能演进](docs/project-design.md#4-功能演进)。

---

## License

Private. 个人项目。
