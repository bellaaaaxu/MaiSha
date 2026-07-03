-- 014: 匿名使用事件（留存埋点）
-- 只进不出：客户端仅可 insert 自己的事件；读取走 Dashboard SQL editor / service role。
-- spec: docs/superpowers/specs/2026-07-03-analytics-sentry-design.md

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
  for insert to authenticated
  with check (auth.uid() = uid);

create index events_name_created_idx on public.events (name, created_at);
create index events_uid_created_idx on public.events (uid, created_at);

-- 北极星：每周有 complete_trip 的清单数
create view public.analytics_weekly_north_star as
select
  date_trunc('week', created_at)::date as week,
  count(distinct list_id) as lists_with_completed_trip
from public.events
where name = 'complete_trip' and env = 'prod'
group by 1
order by 1 desc;

-- 周活跃用户（任意事件）
create view public.analytics_weekly_active_users as
select
  date_trunc('week', created_at)::date as week,
  count(distinct uid) as active_users
from public.events
where env = 'prod'
group by 1
order by 1 desc;

-- W1/W4 周留存 cohort：按用户首个事件周分组
create view public.analytics_weekly_retention as
with firsts as (
  select uid, date_trunc('week', min(created_at))::date as cohort_week
  from public.events
  where env = 'prod'
  group by uid
),
activity as (
  select distinct uid, date_trunc('week', created_at)::date as week
  from public.events
  where env = 'prod'
)
select
  f.cohort_week,
  count(distinct f.uid) as cohort_size,
  count(distinct a1.uid) as w1_retained,
  round(100.0 * count(distinct a1.uid) / nullif(count(distinct f.uid), 0), 1) as w1_pct,
  count(distinct a4.uid) as w4_retained,
  round(100.0 * count(distinct a4.uid) / nullif(count(distinct f.uid), 0), 1) as w4_pct
from firsts f
left join activity a1 on a1.uid = f.uid and a1.week = (f.cohort_week + interval '1 week')::date
left join activity a4 on a4.uid = f.uid and a4.week = (f.cohort_week + interval '4 week')::date
group by 1
order by 1 desc;

-- Supabase 对 public 下新对象默认授权 anon/authenticated；
-- 视图以 owner 身份执行会绕过 events 的 RLS，必须显式收回
revoke all on public.analytics_weekly_north_star from anon, authenticated;
revoke all on public.analytics_weekly_active_users from anon, authenticated;
revoke all on public.analytics_weekly_retention from anon, authenticated;
