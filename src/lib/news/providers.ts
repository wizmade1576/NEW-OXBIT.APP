// Reddit fallback removed; keep types local
import getSupabase from '../supabase/client'
import { fetchWithTimeout } from '../net/proxy'

export interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

type Topic = 'crypto' | 'stocks' | 'fx'

const MARKET_AUX_KEY = import.meta.env.VITE_MARKETAUX_KEY as string | undefined
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY as string | undefined
const NEWSAPI_KEY = import.meta.env.VITE_NEWSAPI_KEY as string | undefined

// Unified entry per topic with fallback
// Always use Supabase Edge Function ONLY
export async function fetchTopic(
  topic: Topic,
  cursorOrPage?: string | number,
  limit = 10
) {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (base) {
    const url = new URL(`${base}/functions/v1/news-proxy`)
    url.searchParams.set('topic', topic)
    if (typeof cursorOrPage === 'number') {
      url.searchParams.set('page', String(cursorOrPage))
    }
    url.searchParams.set('limit', String(limit))

    const headers: Record<string, string> = {}
    if (anon) {
      headers['apikey'] = anon
      headers['Authorization'] = `Bearer ${anon}`
    }

    try {
      const res = await fetch(url.toString(), { headers })
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data?.items) ? data.items : []
        const nextPage = data?.nextPage ?? undefined
        const cursor = data?.nextCursor ?? undefined
        return { items, nextPage, cursor, provider: 'none' }
      }
    } catch (e) {
      console.error('news-proxy GET error', e)
    }
  }

  // If fail => return empty instead of RSS fallback (CORS 방지)
  return { items: [], provider: 'none' }
}
