# Vercel 部署

## 首次部署

1. 访问 [vercel.com](https://vercel.com) → **Sign up with GitHub**（用你的 GitHub 账号 bellaaaaxu）
2. 进入 dashboard → **Add New → Project**
3. Import 你的 `bellaaaaxu/MaiSha` repo
4. Framework Preset: **Vite**（自动识别）
5. 展开 "Environment Variables" 填入：
   - `VITE_SUPABASE_URL` = `https://zpgotgjgoisykqcmtciu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = （Supabase Settings → API 里的 anon public key，就是本地 `.env` 里那串）
6. 点 **Deploy** → 等 1-2 分钟
7. 成功后得到默认域名，格式形如 `maisha-xxx.vercel.app`

## 后续更新

```bash
git push origin main
```
Vercel 自动触发新部署，一般 30 秒内上线。

## 给老公分享

部署完拿到正式 URL 后：
1. 在电脑浏览器打开 `https://maisha-xxx.vercel.app`
2. 匿名会话自动建清单（你的 uid 创建，绑定 TNT/元初/Costco/未分类 超市）
3. 点"设置 → 邀请老公（复制链接）"→ 粘贴到微信/iMessage 发给他
4. 他点链接在自己手机浏览器打开 → 自动加入同一清单
5. 双方都可以"添加到主屏幕"（iOS: Safari 分享 → 添加到主屏幕；Android Chrome 右上角菜单 → Add to home screen）

## 自定义域名（可选）

Vercel Dashboard → Project → Settings → Domains → Add。按提示在域名解析商加 CNAME。

## 备选：Cloudflare Pages

万一 Vercel 在你所在网络不稳，同一个 repo 可以部署到 Cloudflare Pages：
1. [pages.cloudflare.com](https://pages.cloudflare.com) → Connect Git → 选 MaiSha
2. Build command: `npm run build`
3. Build output directory: `dist`
4. 环境变量同上
