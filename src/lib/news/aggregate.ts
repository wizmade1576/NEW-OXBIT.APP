// aggregate.ts
// Mix 모드에서 "첫 페이지"를 Supabase Edge Function이 실패했을 때만 사용되는 보조 수집기

export interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

export interface FetchAllResult {
  items: NewsItem[]
}

/**
 * fetchAllTopics()
 *
 * - 일반 단일 topic은 Supabase Edge Function(fetchTopic)으로 처리.
 * - 이 함수는 mix 모드가 죽었을 때 “응급용 첫 페이지”로만 사용된다.
 */
export async function fetchAllTopics(
  options: { limitPerTopic?: number } = {}
): Promise<FetchAllResult> {
  const limit = options.limitPerTopic ?? 10

  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

    if (base) {
      const url = new URL(`${base}/functions/v1/news-proxy`)
      url.searchParams.set('topic', 'all')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('page', '1')

      const headers: Record<string, string> = {}
      if (anon) {
        headers['apikey'] = anon
        headers['Authorization'] = `Bearer ${anon}`
      }

      const r = await fetch(url.toString(), { headers })
      if (r.ok) {
        const j = await r.json()
        const arr: NewsItem[] = Array.isArray(j?.items) ? j.items : []
        return { items: arr }
      }
    }
  } catch (e) {
    console.error('aggregate fetchAllTopics fallback error', e)
  }

  // 완전히 실패하면 빈 배열만 반환 (UI 안죽게)
  return { items: [] }
}

// 다른 곳에서 default import로 쓸 수도 있으니 같이 내보냄
export default fetchAllTopics
