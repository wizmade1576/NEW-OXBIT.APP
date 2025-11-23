# Supabase ê¸°ë°˜ ê´€ë¦¬ì ? ë„ë¦¬í‹±??
## ê°œìš”
- ?˜ì´ì§€ ?´ë²¤?¸ë? Supabase `page_events` ?Œì´ë¸”ì— ?“ê³ , Edge Function `analytics-report`ë¡?ì§‘ê³„?˜ì—¬ ê´€ë¦¬ì ?˜ì´ì§€???¸ì¶œ?©ë‹ˆ??
- ?´ë¼?´ì–¸?¸ëŠ” ?¼ìš°??ë³€ê²???`analytics-track` ?¨ìˆ˜??page_viewë¥??„ì†¡?©ë‹ˆ??

## ?Œì´ë¸?(DDL)
- ?ì„± ?Œì¼: `supabase/migrations/20250101000000_create_page_events.sql`
```sql
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
create index if not exists idx_page_events_created_at on public.page_events (created_at);
create index if not exists idx_page_events_path on public.page_events (path);
```

## Edge Functions
- `supabase/functions/analytics-track`: page_view ?´ë²¤???˜ì§‘ (POST `{ path, ua?, userId?, country?, device? }`).
  - `ANALYTICS_INGEST_SECRET`ê°€ ?¤ì •?˜ì–´ ?ˆìœ¼ë©?`x-analytics-secret` ?¤ë”ê°€ ?¼ì¹˜?´ì•¼ ?©ë‹ˆ???µì…˜).
- `supabase/functions/analytics-report`: ìµœê·¼ 7??ë°©ë¬¸ ì¶”ì´, ?ìœ„ ê²½ë¡œ, ê¸°ê¸°/êµ?? ë¶„í¬, ìµœê·¼ 5ë¶??œì„± ?¸ì…˜ ?˜ë? ë°˜í™˜.
- `supabase/functions/analytics-realtime`: SSEë¡?ìµœê·¼ 5ë¶??œì„± ?¸ì…˜ ?˜ë? 5ì´ˆë§ˆ???¤íŠ¸ë¦¬ë°.

### ë°°í¬
```bash
# ?Œì´ë¸?migration ?ìš© (Supabase ?„ë¡œ?íŠ¸?ì„œ ?¤í–‰)
supabase db push

# Edge functions ë°°í¬
supabase functions deploy analytics-track
supabase functions deploy analytics-report
supabase functions deploy analytics-realtime
```

?„ìˆ˜ ë¹„ë???(Supabase dashboard ?ëŠ” CLI `supabase secrets set`):
- `SUPABASE_SERVICE_ROLE_KEY` (?´ë? ê¸°ë³¸ ?œê³µ, functions ?˜ê²½???¤ì • ?„ìš”)
- ? íƒ: `ANALYTICS_INGEST_SECRET` (?˜ì§‘ ?”ë“œ?¬ì¸??ë³´í˜¸?? ?¤ì • ???´ë¼?´ì–¸?¸ì? ?¤ë” ë§ì¶°????

## ?„ëŸ°?¸ì—”???°ë™
- ?˜ì´ì§€: `src/pages/admin/AnalyticsPage.tsx`  
  - ê¸°ë³¸ ?”ë“œ?¬ì¸?? `${VITE_SUPABASE_URL}/functions/v1/analytics-report` (?†ìœ¼ë©?`/api/admin/analytics` ?´ë°±)
- ?¼ìš°???ˆì´?„ì›ƒ: `src/app/layouts/RootLayout.tsx`  
  - ê²½ë¡œ ë³€ê²???`${VITE_SUPABASE_URL}/functions/v1/analytics-track` ë¡?page_view ?„ì†¡.

## ?™ì‘ ?•ì¸
1) `supabase functions serve`ë¡?ë¡œì»¬ ?¨ìˆ˜ ?¤í–‰ ???±ì—???¼ìš°???´ë™ ??ì½˜ì†”/?¤íŠ¸?Œí¬?ì„œ `analytics-track` 200 ?¬ë? ?•ì¸.
2) ê´€ë¦¬ì ?˜ì´ì§€ ?ˆë¡œê³ ì¹¨ ??`analytics-report` ?‘ë‹µ JSON??`source: "supabase"`?€ ì§‘ê³„ ?°ì´?°ê? ?ˆëŠ”ì§€ ?•ì¸.
3) ?Œì´ë¸??°ì´?°ëŠ” Supabase SQL ?ë””?°ì—??`select * from page_events order by created_at desc limit 20;` ë¡??•ì¸.

- Å¬¶óÀÌ¾ğÆ® È£Ãâ ½Ã apikey/Authorization Çì´õ¿¡ VITE_SUPABASE_ANON_KEY¸¦ Æ÷ÇÔÇØ¾ß 401À» ÇÇÇÒ ¼ö ÀÖ½À´Ï´Ù. SSE(EventSource)´Â Äõ¸®½ºÆ®¸µ apikey=... ·Î Àü´ŞÇÕ´Ï´Ù.
