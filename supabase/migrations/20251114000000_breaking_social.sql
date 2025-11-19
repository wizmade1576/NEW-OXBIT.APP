-- Breaking social: likes and comments with RLS

-- Likes table
create table if not exists public.breaking_likes (
  breaking_id uuid not null references public.breaking_news(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (breaking_id, user_id)
);
create index if not exists idx_breaking_likes_bid on public.breaking_likes (breaking_id);

alter table public.breaking_likes enable row level security;
drop policy if exists likes_read_all on public.breaking_likes;
drop policy if exists likes_insert_own on public.breaking_likes;
drop policy if exists likes_delete_own on public.breaking_likes;
create policy likes_read_all on public.breaking_likes for select using (true);
create policy likes_insert_own on public.breaking_likes for insert with check (auth.uid() = user_id);
create policy likes_delete_own on public.breaking_likes for delete using (auth.uid() = user_id);

-- Comments table
create table if not exists public.breaking_comments (
  id uuid primary key default gen_random_uuid(),
  breaking_id uuid not null references public.breaking_news(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_breaking_comments_bid on public.breaking_comments (breaking_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_breaking_comments_set_updated_at on public.breaking_comments;
create trigger trg_breaking_comments_set_updated_at before update on public.breaking_comments
for each row execute function public.set_updated_at();

alter table public.breaking_comments enable row level security;
drop policy if exists comments_read_all on public.breaking_comments;
drop policy if exists comments_insert_own on public.breaking_comments;
drop policy if exists comments_update_own on public.breaking_comments;
drop policy if exists comments_delete_own on public.breaking_comments;
create policy comments_read_all on public.breaking_comments for select using (true);
create policy comments_insert_own on public.breaking_comments for insert with check (auth.uid() = user_id);
create policy comments_update_own on public.breaking_comments for update using (auth.uid() = user_id);
create policy comments_delete_own on public.breaking_comments for delete using (auth.uid() = user_id);

