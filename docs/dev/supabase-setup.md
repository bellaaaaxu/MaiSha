# Supabase 项目配置

## 1. 创建项目

1. 访问 [supabase.com](https://supabase.com) 用 GitHub 登录
2. "New project" → 名称 `maisha` → 免费版
3. 选 Region：**West US (N. California)** 或 **Oregon**（温哥华最近）
4. 设置 database password → 保存好（不要分享给任何人，包括 AI）
5. 等 1-2 分钟项目创建完成

## 2. 启用匿名登录

1. Authentication → Providers → **Anonymous Sign-Ins** → Enable
2. Save

## 3. 运行 migration

1. SQL Editor → New query
2. 粘贴 `supabase/migrations/001_initial_schema.sql` 全部内容
3. Run → 确认无错

## 4. 启用 Realtime

1. Database → Replication → `supabase_realtime` publication
2. 勾选 `public.items` 和 `public.lists` 两张表

## 5. 拿到环境变量

1. Project Settings → API
2. 复制 **Project URL** → `.env` 中 `VITE_SUPABASE_URL=<url>`
3. 复制 **anon public** key（不是 service_role！）→ `.env` 中 `VITE_SUPABASE_ANON_KEY=<key>`

## 密钥安全

| Key | 能不能公开 | 去哪放 |
|---|---|---|
| **anon public** | ✅ 可以 | `.env` / Vercel env / 前端 |
| **service_role** | ❌ 绝对不行 | 只在后端/云函数 |
| **database password** | ❌ 绝对不行 | 只在管理库时 |

anon key 设计就是嵌入前端代码的，由 RLS 规则保证数据安全。
