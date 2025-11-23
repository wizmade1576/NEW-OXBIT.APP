-- add is_important column to breaking_news
alter table if exists public.breaking_news
  add column if not exists is_important boolean default false;

-- refresh postgrest schema cache
notify pgrst, 'reload schema';
