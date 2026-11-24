-- STASH personal subscription tracking
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'ZAR',
  payment_date date not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Users manage their own subscriptions" on public.subscriptions;
create policy "Users manage their own subscriptions"
on public.subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
