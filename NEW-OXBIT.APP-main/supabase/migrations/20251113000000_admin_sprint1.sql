-- Sprint 1: Roles/Profiles, Breaking News, Ads, and RLS policies

-- 1) profiles table + trigger to create row on new user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','editor','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
drop policy if exists read_own_profile on public.profiles;
drop policy if exists update_own_profile on public.profiles;
create policy read_own_profile on public.profiles for select using (auth.uid() = id);
create policy update_own_profile on public.profiles for update using (auth.uid() = id);

-- helper to check admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin')
$$;

-- 2) breaking_news table
create table if not exists public.breaking_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  tag text,
  source_link text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  pinned boolean default false,
  publish_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_breaking_status_pub on public.breaking_news (status, publish_at desc, created_at desc);

drop trigger if exists trg_breaking_set_updated_at on public.breaking_news;
create trigger trg_breaking_set_updated_at before update on public.breaking_news
for each row execute function public.set_updated_at();

