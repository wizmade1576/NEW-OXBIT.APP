-- Create schedules table for market schedule page
create extension if not exists pgcrypto;

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('economic','crypto','listing')),
  date timestamptz not null,
  importance int,
  country text,
  coin text,
  description text,
  source text
);

alter table public.schedules enable row level security;

-- Read for anon key (frontend)
-- (CREATE POLICY doesn't support IF NOT EXISTS in some Postgres versions)
drop policy if exists schedules_read_anon on public.schedules;
create policy schedules_read_anon
  on public.schedules for select
  to anon
  using (true);

-- Helpful indexes
create index if not exists schedules_date_idx on public.schedules (date asc);
create index if not exists schedules_category_date_idx on public.schedules (category, date asc);

-- Optional seed (comment out if not needed)
-- insert into public.schedules (title, category, date, importance, country, coin, description, source)
-- values
--   ('미국 CPI 발표', 'economic', now() + interval '2 day', 3, 'US', null, '소비자물가지수 발표', 'BLS'),
--   ('ETH 네트워크 업그레이드', 'crypto', now() + interval '3 day', 2, null, 'ETH', '업그레이드 활성화', 'Ethereum'),
--   ('신규 상장: COINX', 'listing', now() + interval '1 day', 3, null, 'COINX', '거래소 신규 상장', 'Exchange');
