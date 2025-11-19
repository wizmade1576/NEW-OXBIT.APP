export interface NewsItem {
  id: string
  title: string
  summary?: string
  url: string
  image?: string
  date: string
  source: string
}

interface RedditListing {
  data: {
    after?: string
    children: { data: any }[]
  }
}

function pickImage(d: any): string | undefined {
  try {
    const preview = d?.preview?.images?.[0]?.source?.url as string | undefined
    if (preview) return preview.replace(/&amp;/g, '&')
  } catch {}
  const thumb = typeof d?.thumbnail === 'string' ? d.thumbnail : undefined
  if (thumb && thumb.startsWith('http')) return thumb
  return undefined
}

export async function fetchRedditPosts(subreddit: string, after?: string, limit = 10): Promise<{ items: NewsItem[]; after?: string }> {
  const base = import.meta.env.DEV ? '/reddit' : 'https://www.reddit.com'
  const url = new URL(`${base}/r/${subreddit}/hot.json`, window.location.origin)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('raw_json', '1')
  if (after) url.searchParams.set('after', after)
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  const json = (await res.json()) as RedditListing
  const items: NewsItem[] = json.data.children.map(({ data: d }: any) => ({
    id: d.id,
    title: d.title,
    summary: d.selftext ? String(d.selftext).slice(0, 280) : undefined,
    url: `https://www.reddit.com${d.permalink}`,
    image: pickImage(d),
    date: new Date((d.created_utc || d.created) * 1000).toLocaleString('ko-KR'),
    source: `r/${subreddit}`,
  }))
  return { items, after: json.data.after }
}

export default fetchRedditPosts
