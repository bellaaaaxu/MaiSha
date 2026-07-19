-- 015: 钤印集章——account 级收藏，印记不可逆（无 DELETE 策略）
-- spec: docs/superpowers/specs/2026-07-19-seal-collection-design.md

create table public.seal_collection (
  account_id uuid not null references public.accounts(id) on delete cascade,
  seal_id text not null,                    -- flora 成员 id，永不改名（单向门沿袭）
  first_earned_at timestamptz not null default now(),
  first_store text not null default '',     -- 首钤回忆三件套，只写一次
  first_item_count int not null default 0,
  times_earned int not null default 1,
  primary key (account_id, seal_id)
);

alter table public.seal_collection enable row level security;

create policy seal_select_own on public.seal_collection
  for select to authenticated
  using (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));

create policy seal_insert_own on public.seal_collection
  for insert to authenticated
  with check (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));

create policy seal_update_own on public.seal_collection
  for update to authenticated
  using (account_id in (select id from public.accounts where auth.uid() = any(member_uids)));
-- 刻意无 delete 策略：钤下的印记不可逆
