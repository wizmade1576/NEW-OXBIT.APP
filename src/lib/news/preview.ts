export function hostname(url?: string): string {
  try { return url ? new URL(url).hostname : '' } catch { return '' }
}

export function domainIcon(url?: string): string {
  const h = hostname(url)
  return h ? `https://icons.duckduckgo.com/ip3/${h}.ico` : '/favicon.svg'
}

function lcKey(url: string) { return `preview:${encodeURIComponent(url)}` }

export async function resolvePreviewImage(url: string, current?: string): Promise<string> {
  // Cached?
  try {
    const hit = localStorage.getItem(lcKey(url))
    if (hit) return hit
  } catch {}

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  const setCache = (v: string) => { try { localStorage.setItem(lcKey(url), v) } catch {} ; return v }

  // 1) Microlink API (best-effort preview)
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=false&iframe=false&screenshot=false`, { signal: controller.signal })
    if (res.ok) {
      const j: any = await res.json()
      const v = j?.data?.image?.url || j?.data?.logo?.url
      if (typeof v === 'string' && v.startsWith('http')) { clearTimeout(timer); return setCache(v) }
    }
  } catch {}

  // 2) Fetch raw HTML via AllOrigins and parse OG/Twitter image
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: controller.signal })
    if (res.ok) {
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const og = doc.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute('content')
        || doc.querySelector('meta[property="twitter:image"], meta[name="twitter:image"]')?.getAttribute('content')
        || doc.querySelector('link[rel="image_src"]')?.getAttribute('href')
      if (og && og.startsWith('http')) { clearTimeout(timer); return setCache(og) }
    }
  } catch {}

  clearTimeout(timer)
  // 3) Fallbacks
  if (current && current.startsWith('http')) return current
  return domainIcon(url)
}

