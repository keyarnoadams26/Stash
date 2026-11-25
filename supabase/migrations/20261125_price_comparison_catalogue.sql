-- STASH provider-fed subscription price catalogue.
-- Only trusted server-side imports should write records; users can read published offers.
create table if not exists public.stash_price_comparisons (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  provider_name text not null,
  plan_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  billing_period text not null check (billing_period in ('monthly','yearly')),
  region text not null default 'GLOBAL',
  source_url text not null,
  verified_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.stash_price_comparisons enable row level security;
drop policy if exists "Authenticated users view active price comparisons" on public.stash_price_comparisons;
create policy "Authenticated users view active price comparisons"
  on public.stash_price_comparisons for select
  to authenticated using (is_active = true);
