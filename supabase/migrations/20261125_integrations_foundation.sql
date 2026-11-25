-- STASH integrations foundation: notification preferences, push endpoints and bank sandbox metadata.
-- No bank credentials or full account numbers are stored in STASH.

create table if not exists public.stash_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  reminder_days integer not null default 3 check (reminder_days between 0 and 30),
  updated_at timestamptz not null default now()
);
alter table public.stash_notification_preferences enable row level security;
drop policy if exists "Users manage own notification preferences" on public.stash_notification_preferences;
create policy "Users manage own notification preferences"
  on public.stash_notification_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.stash_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.stash_push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.stash_push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.stash_push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.stash_bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  display_name text,
  institution_name text,
  status text not null default 'sandbox' check (status in ('sandbox','active','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, provider, provider_account_id)
);
alter table public.stash_bank_connections enable row level security;
drop policy if exists "Users view own bank connections" on public.stash_bank_connections;
create policy "Users view own bank connections"
  on public.stash_bank_connections for select
  using (auth.uid() = user_id);
-- Inserts/updates are server-side only; no provider tokens are exposed to clients.

create table if not exists public.stash_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.stash_bank_connections(id) on delete cascade,
  provider_transaction_id text not null,
  description text not null,
  amount numeric(12,2) not null,
  currency text not null,
  transaction_date date not null,
  recurring_candidate boolean not null default false,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_transaction_id)
);
alter table public.stash_bank_transactions enable row level security;
drop policy if exists "Users view own bank transactions" on public.stash_bank_transactions;
create policy "Users view own bank transactions"
  on public.stash_bank_transactions for select
  using (auth.uid() = user_id);

create table if not exists public.stash_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  channel text not null check (channel in ('email','push')),
  sent_at timestamptz not null default now(),
  unique(user_id, event_key, channel)
);
alter table public.stash_notification_log enable row level security;
drop policy if exists "Users view own notification log" on public.stash_notification_log;
create policy "Users view own notification log"
  on public.stash_notification_log for select
  using (auth.uid() = user_id);
