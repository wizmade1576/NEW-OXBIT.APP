-- Page events for admin analytics (Supabase-based)
create table if not exists public.page_events (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  path text not null,
  ua text,
  country text,
  device text,
  created_at timestamptz not null default now()
);

alter table public.page_events enable row level security;

-- Indexes for common queries
create index if not exists idx_page_events_created_at on public.page_events (created_at);
create index if not exists idx_page_events_path on public.page_events (path);
