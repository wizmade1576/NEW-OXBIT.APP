export async function fetchWithTimeout(input: RequestInfo | URL, timeoutMs = 8000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...(init||{}), signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

export async function fetchJsonWithProxy(url: string, timeoutMs = 8000): Promise<any> {
  // Try direct first
  try {
    const r = await fetchWithTimeout(url, timeoutMs)
    if (r.ok) return await r.json()
  } catch {}
  // Then via r.jina.ai http mirror
  try {
    const mirror = `https://r.jina.ai/http/${url.replace(/^https?:\/\//,'')}`
    const r = await fetchWithTimeout(mirror, timeoutMs)
    if (r.ok) {
      const txt = await r.text()
      try { return JSON.parse(txt) } catch {}
    }
  } catch {}
  // Then via AllOrigins
  try {
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const r = await fetchWithTimeout(proxied, timeoutMs)
    if (r.ok) {
      const txt = await r.text()
      try { return JSON.parse(txt) } catch {}
    }
  } catch {}
  throw new Error('proxy_failed')
}

