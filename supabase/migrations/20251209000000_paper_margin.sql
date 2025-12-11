create extension if not exists "pgcrypto";

create table if not exists public.paper_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  krw_balance numeric not null default 10000000,
  is_liquidated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  entry_price numeric not null,
  leverage integer not null check (leverage > 0),
  amount numeric not null,
  margin numeric not null,
  liquidation_price numeric not null,
  take_profit numeric null,
  stop_loss numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('open', 'close', 'liq')),
  symbol text not null,
  price numeric not null,
  amount numeric not null,
  leverage integer not null check (leverage > 0),
  pnl numeric not null,
  created_at timestamptz not null default now()
);
