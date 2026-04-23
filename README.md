# 买啥 MaiSha

轻量、共享的家庭购物清单 PWA。两人实时同步，按超市分组，到店不漏买。可"添加到主屏幕"像原生 APP 一样使用。

## 特性

- 🛒 按超市分组（TNT / 元初 / Costco / 未分类，可自定义）
- 🏷️ 按品类 emoji 副分组（蔬菜/水果/肉蛋/乳制品…）
- 👫 两人共享，**实时同步**（Supabase Realtime）
- 🔗 复制链接邀请，**零注册零登录**
- 🖐️ **长按拖拽**物品换超市（"白菜我在元初买了，拖过去"）
- 🛍️ **一键完成采购**按钮，清掉已购
- 📋 清单可导出纯文本（给不用小程序的家人）
- 🎨 常买 / 最近添加 chips，少打字
- 📲 PWA 可安装到主屏幕，离线也能浏览已加载清单

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS
- Supabase（Postgres + Realtime + Anonymous Auth + RLS）
- @dnd-kit/core（拖拽）
- vite-plugin-pwa（manifest + service worker）
- Vitest（utils 单测，25 个）

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置 .env
cp .env.example .env
# 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
# （见 docs/dev/supabase-setup.md）

# 3. 运行
npm run dev           # dev server
npm test              # jest-like 单测
npm run typecheck     # tsc --noEmit
npm run build         # 生产构建
```

## 首次使用

1. [Supabase 配置](docs/dev/supabase-setup.md) — 建 project, 跑 migration, 启用匿名登录和 Realtime
2. [Vercel 部署](docs/dev/vercel-deploy.md) — 一键连 GitHub 部署

## 文档

- [设计文档](docs/superpowers/specs/2026-04-23-maisha-design.md)
- [实现计划](docs/superpowers/plans/2026-04-23-maisha-v1.md)
- [Supabase 配置](docs/dev/supabase-setup.md)
- [Vercel 部署](docs/dev/vercel-deploy.md)

## 路线图

- **v1** ✅ 购物清单 + 分享邀请 + PWA + 拖拽换超市
- **v2** 库存 + 拍照生产日期 + 过期提醒
- **v3** 菜谱 + 下周菜单规划
- **v∞**（可选）Capacitor.js 包成 iOS/Android 原生 APP

## License

Private. 个人项目。
