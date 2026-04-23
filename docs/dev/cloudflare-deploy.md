# Cloudflare Pages 部署

## 首次部署（5 分钟）

1. 访问 [pages.cloudflare.com](https://pages.cloudflare.com) → 用 GitHub 登录（账号 `bellaaaaxu`）
2. 左侧 **Workers & Pages → Create → Pages → Connect to Git**
3. 选择 repo **`bellaaaaxu/MaiSha`** → **Begin setup**
4. **Framework preset**：选 **Vite**（自动识别）
   - Build command 自动填 `npm run build`
   - Build output directory 自动填 `dist`
5. 展开 **Environment variables (advanced)**，添加 2 个 **Production** 变量：
   - `VITE_SUPABASE_URL` = `https://zpgotgjgoisykqcmtciu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = （Supabase Settings → API 里的 anon public key）
6. **Save and Deploy** → 等 2-3 分钟
7. 成功后拿到默认域名，格式形如 `maisha.pages.dev` 或 `maisha-xxx.pages.dev`

## Node 版本（如需）

CF Pages 默认 Node 18 应该能跑。如遇构建报错：
- Environment variables 里再加一个：`NODE_VERSION` = `20`

## 后续更新

```bash
git push origin main
```
CF Pages 自动触发新部署，一般 1-2 分钟内上线。

## SPA 回退

Cloudflare 部署时会自动配置 Workers + Static Assets，在 `wrangler.jsonc` 里生成：
```json
"assets": { "not_found_handling": "single-page-application" }
```
这个原生机制就能在 `/list`、`/settings` 等子路径刷新时回退到 `index.html` 由 React Router 接管。**不需要也不能有 `_redirects` 文件**（会与 SPA 回退冲突触发死循环检测）。

## 给老公分享

部署完拿到 URL（如 `https://maisha.pages.dev`）后：
1. 自己电脑/手机浏览器打开 URL
2. 匿名会话自动建清单（TNT/元初/Costco/未分类 超市就位）
3. 点"设置 → 邀请老公（复制链接）"→ 粘贴到微信/iMessage 发给他
4. 他点链接在自己浏览器打开 → 自动加入同一清单
5. 双方都可以"添加到主屏幕"：
   - **iOS Safari**：分享按钮 → "添加到主屏幕"
   - **Android Chrome**：右上角菜单 → "添加到主屏幕" / "安装应用"

## 自定义域名（可选）

Pages project → **Custom domains** → Set up a custom domain → 按提示在域名解析商加 CNAME。如果域名本身就托管在 Cloudflare 则一键搞定。

## 备选：Vercel

如果 CF 有任何问题，可以换 Vercel：同样连 GitHub repo，同样的 env vars；需要加一个 `vercel.json` 做 SPA 回退：
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
