# 留存埋点 + Sentry 错误监控 — Design Spec

**Date:** 2026-07-03
**Status:** Approved（三项选型 2026-07-03 用户拍板：Supabase 自建表 / Sentry errors-only / SQL 视图看板）

## 1. 目标

上架前装上「眼睛」：① 五个核心事件回答「核心循环留不留得住人」；② Sentry 捕获线上错误（否则 crash 只表现为流失）。主指标 **W1/W4 周留存**（买菜是周行为）；北极星 = **每周完成 ≥1 次采购的清单数**。

## 2. 选型与理由

| 决策 | 选择 | 理由 |
|---|---|---|
| 事件后端 | **Supabase 自建 `events` 表** | 零新 SDK/零包重；数据不出自家 Postgres；App Store 隐私标签只需「使用数据·不关联身份」；与「不收集个人数据」叙事自洽 |
| 错误监控 | **@sentry/react，errors-only** | 只捕获错误（含 unhandled rejection），不开 tracing/replay；仅生产构建初始化（`VITE_SENTRY_DSN` + `import.meta.env.PROD` 双门槛），本地零噪音；免费层 5k errors/月 |
| 看板 | **migration 内建 SQL 视图 + 本 spec 查询手册** | Supabase Dashboard SQL editor 直接看，零运维 |

## 3. 数据设计（migration `014_events.sql`）

```sql
-- 匿名使用事件。只进不出：客户端仅可 insert 自己的事件；读取走 Dashboard/service role
create table public.events (
  id bigint generated always as identity primary key,
  uid uuid not null,
  name text not null,
  list_id uuid,
  props jsonb not null default '{}'::jsonb,
  platform text,   -- web / ios / android（Capacitor.getPlatform()）
  lang text,       -- 当前界面语言
  ua_env text,     -- wechat / other：微信 webview 识别，服务于分享链路验证
  env text not null default 'prod',  -- dev / prod：本地开发事件照常入库，但被分析视图排除
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy events_insert_own on public.events
  for insert to authenticated with check (auth.uid() = uid);
create index events_name_created_idx on public.events (name, created_at);
create index events_uid_created_idx on public.events (uid, created_at);
```

三个分析视图（**必须 revoke**——Supabase 对 public 表默认给 anon/authenticated 授权，视图以 owner 身份绕过 RLS）：

- `analytics_weekly_north_star` — 北极星：每周有 `complete_trip` 的清单数
- `analytics_weekly_active_users` — 周活跃用户（任意事件）
- `analytics_weekly_retention` — cohort 表：按用户首个事件周分组，算 W1/W4 留存数与百分比

三视图均只统计 `env = 'prod'`——dev 与生产共用同一个 Supabase 项目，本地调试事件照常入库（便于验证）但不污染留存数据。

```sql
revoke all on analytics_weekly_north_star, analytics_weekly_active_users, analytics_weekly_retention
  from anon, authenticated;
```

## 4. 客户端埋点（`src/lib/analytics.ts`）

```ts
track(name, { listId?, props? })   // fire-and-forget，任何失败静默吞掉，绝不影响主流程
```

- uid 取自 `supabase.auth.getSession()`（本地读取，无网络请求）；无会话则丢弃事件。
- 自动附带 `platform`（Capacitor）、`lang`（i18n.resolvedLanguage）、`ua_env`（`/MicroMessenger/i` 测 UA → wechat/other）、`env`（dev/prod，按 `import.meta.env.PROD`）。
- 纯函数 `buildEventRow` 拆出可单测；插入包装层不测（沿用 db.ts 惯例）。

### 五个事件与挂点

| 事件 | 挂点 | props |
|---|---|---|
| `add_item` | List.tsx `onAdd` 成功（`{source:'sheet', count:1}`）；`onImport` 成功后按批次一次（`{source:'import', count:N}`） | source, count |
| `complete_trip` | ShoppingEndModal `savePurchaseHistory` 成功后 | items（件数）, store（店名） |
| `share_link_open` | List.tsx 挂载时 `joinListId` 存在（收到邀请链接打开），每次挂载一次 | —（ua_env 自动带，微信假设验证的关键口径） |
| `list_join` | List.tsx：邀请链接打开且清单解析成功后（不侵入数据层）；含回访重开，分析按 (uid, list_id) 去重 = 真实加入 | — |
| `store_finder_used` | StoreFinder 触发搜索处 | query（商品名——自家后端，与 items 表同一信任边界） |

> 统计口径：`add_item` 总件数 = `sum((props->>'count')::int)`，非行数。

## 5. Sentry（`src/lib/sentry.ts`）

```ts
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;
  Sentry.init({ dsn, environment: 'production', sendDefaultPii: false });
}
```

- main.tsx 最顶部调用（早于 React 渲染，捕获初始化错误）。
- 不加 ErrorBoundary、不传 release/sourcemap（后续可选优化：sentry-cli 上传 sourcemap 让堆栈可读）。
- `.env.example` 增加 `VITE_SENTRY_DSN=`；生产 DSN 配在 Cloudflare 构建环境变量。

## 6. 隐私同步（Privacy.tsx，本次一并改）

1. 「我们收集什么」增两条：**匿名使用统计**（功能使用事件，关联匿名标识，仅用于改进产品，不含设备指纹、不用于广告）；**错误诊断日志**（出错时经 Sentry 收集错误堆栈与设备环境信息，用于修复问题）。
2. 修正**既有失实条目**「不追踪地理位置」→「不后台追踪地理位置；仅在你主动使用『查超市』时于设备本地读取位置用于附近搜索（Apple 地图），我们的服务器不接收、不存储你的位置」。（store-finder 已用定位权限，政策与权限描述不一致是提审被拒理由。）
3. 「第三方服务」增加 Sentry（错误诊断）。
4. 最后更新日期 → 2026 年 7 月。
5. App Store 隐私标签申报口径：使用数据·产品交互（不关联身份）+ 诊断数据（不关联身份）；仍无广告/追踪。

## 7. 查询手册（上架后每周看一眼）

```sql
select * from analytics_weekly_north_star;    -- 北极星走势
select * from analytics_weekly_retention;      -- W1/W4 cohort（对标生产力类 D30 12–18% 的周化代理）
select name, count(*), count(distinct uid) from events
  where created_at > now() - interval '7 days' group by 1;  -- 事件健康度
select ua_env, count(distinct uid) from events
  where name = 'share_link_open' group by 1;   -- 邀请打开环境分布（微信 vs 其他）
select count(*) from (select distinct uid, list_id from events
  where name = 'list_join' and env = 'prod') t; -- 真实加入数（uid+list 去重）
```

## 8. Non-goals

- 不做 opt-out 开关（匿名、无个人数据；政策页如实披露即可）
- 不埋五个事件以外的（宁缺毋滥，先验证核心循环）
- 不做看板 UI / 周报脚本（有数据后按需加）
- 不上传 sourcemap（后续优化）

## 9. 部署交接（Windows 无法执行，用户在 Mac/云侧完成）

1. `npx supabase db push`（应用 migration 014）
2. Sentry 注册项目（React）→ 拿 DSN → Cloudflare Pages/Workers 构建环境变量加 `VITE_SENTRY_DSN`
3. 部署后验证：线上触发一次事件 → Dashboard `select * from events order by id desc limit 10;` 有行；Sentry 项目页收到测试错误（可临时在 console 抛错验证）

## 10. 验收

- [x] `events` 表 migration + 三视图 + revoke 齐备（014，含 env 列 dev/prod 隔离）
- [x] 五个事件全部接线，失败静默不影响主流程（preview 实测：events 404 时 join/items 全部照常）
- [x] Sentry 仅生产初始化，本地/测试零噪音
- [x] Privacy.tsx 四处更新（含地理位置失实修正）
- [x] typecheck + 149 测试全过（analytics-core 单测 ×4）
- [x] preview 实测：邀请链接打开触发 share_link_open + list_join → 网络面板 3 条 `POST /rest/v1/events`（404 = 远端表未建，符合预期），console 零报错
- [x] `npm run build` 通过；主 chunk 722KB（min，未 gzip，含 Sentry；单文件在 precache 2MiB 上限内，代码分割留作后续优化）
- [ ] 部署侧（用户执行）：migration 014 push + Sentry DSN 配置 + 线上验证（见 §9）
