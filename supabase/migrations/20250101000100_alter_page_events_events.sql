-- Extend page_events for event types and metadata
alter table public.page_events
  add column if not exists event_type text not null default 'page_view',
  add column if not exists meta jsonb default '{}'::jsonb;

create index if not exists idx_page_events_event_type on public.page_events (event_type);
