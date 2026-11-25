create table if not exists public.stash_verified_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null,
  old_monthly_price numeric(12,2) not null check (old_monthly_price >= 0),
  new_monthly_price numeric(12,2) not null check (new_monthly_price >= 0),
  currency text not null default 'ZAR',
  evidence_note text,
  confirmed_at timestamptz not null default now(),
  constraint savings_must_be_positive check (old_monthly_price > new_monthly_price)
);
alter table public.stash_verified_savings enable row level security;
drop policy if exists "Users manage their own verified savings" on public.stash_verified_savings;
create policy "Users manage their own verified savings"
on public.stash_verified_savings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
