-- STASH personal feature expansion
-- Run this once in Supabase SQL Editor. Safe to re-run.

alter table public.subscriptions
  add column if not exists category text not null default 'Other',
  add column if not exists frequency text not null default 'monthly',
  add column if not exists trial_end date,
  add column if not exists notes text;

do $$ begin
  alter table public.subscriptions add constraint subscriptions_frequency_check
    check (frequency in ('weekly','monthly','quarterly','yearly'));
exception when duplicate_object then null;
end $$;

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'ZAR',
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.payment_history enable row level security;
drop policy if exists "Users manage own payment history" on public.payment_history;
create policy "Users manage own payment history" on public.payment_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists payment_history_user_date_idx on public.payment_history(user_id, paid_at desc);

create table if not exists public.stash_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  currency text not null default 'ZAR',
  created_at timestamptz not null default now(),
  unique(user_id, category)
);
alter table public.stash_budgets enable row level security;
drop policy if exists "Users manage own budgets" on public.stash_budgets;
create policy "Users manage own budgets" on public.stash_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
