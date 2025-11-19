-- add is_important column to breaking_news
alter table if exists public.breaking_news
  add column if not exists is_important boolean default false;
NOTIFY pgrst, 'reload schema';

