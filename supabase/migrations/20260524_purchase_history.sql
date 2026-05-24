create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  supermarket_id text not null,
  supermarket_name text not null,
  items_snapshot jsonb not null default '[]',
  total_count int not null default 0,
  bought_count int not null default 0,
  completed_at timestamptz not null default now()
);

alter table public.purchase_history enable row level security;

create policy "Members can read history" on public.purchase_history
  for select using (
    list_id in (
      select id from public.lists where member_uids @> array[auth.uid()]
    )
  );

create policy "Members can insert history" on public.purchase_history
  for insert with check (
    list_id in (
      select id from public.lists where member_uids @> array[auth.uid()]
    )
  );

create index idx_purchase_history_list on public.purchase_history(list_id, completed_at desc);
