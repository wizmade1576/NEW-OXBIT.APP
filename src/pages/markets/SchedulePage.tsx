import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import ListItemCard from '../../components/ui/ListItemCard'

type Category = 'AIRDROP' | 'LISTING' | 'ECON' | 'OTHER'
type EventItem = {
  id: string
  title: string
  description?: string
  category: Category
  time: string // ISO
  source?: string
  importance?: 1 | 2 | 3 // 3 = high
  url?: string
}

export default function SchedulePage() {
  const UI_KEY = 'schedule_ui_v1'
  const uiInit = React.useMemo(() => { try { return JSON.parse(localStorage.getItem(UI_KEY) || 'null') || {} } catch { return {} } }, [])
  const [zone, setZone] = React.useState<'LOCAL' | 'UTC'>(uiInit.zone || 'LOCAL')
  const [category, setCategory] = React.useState<Category | 'ALL'>(uiInit.category || 'ALL')
  const [range, setRange] = React.useState<'TODAY' | 'WEEK' | 'MONTH'>(uiInit.range || 'WEEK')
  const [query, setQuery] = React.useState(uiInit.query || '')
  const [items, setItems] = React.useState<EventItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const PAGE_SIZE = 20
  const [visible, setVisible] = React.useState(PAGE_SIZE)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const reloadRef = React.useRef<() => void>(() => {})
  const [srcBinance, setSrcBinance] = React.useState(uiInit.srcBinance ?? true)
  const [srcBybit, setSrcBybit] = React.useState(uiInit.srcBybit ?? true)
  const [srcOkx, setSrcOkx] = React.useState(uiInit.srcOkx ?? true)

  React.useEffect(() => { try { localStorage.setItem(UI_KEY, JSON.stringify({ zone, category, range, query, srcBinance, srcBybit, srcOkx })) } catch {} }, [zone, category, range, query, srcBinance, srcBybit, srcOkx])

  // Real data: CoinGecko + Exchange announcements + (optional) TradingEconomics
  React.useEffect(() => {
    let mounted = true
    const pull = async () => {
      try {
        setLoading(true)
        const { from, to } = computeRange(range)
        // Use allSettled + timeouts to avoid any single source hanging the whole UI
        const [eventsRes, updatesRes, listingsRes, econRes] = await Promise.allSettled([
          fetchCoingeckoEvents(from, to),
          fetchCoingeckoStatusUpdates(),
          fetchExchangeListings({ binance: srcBinance, bybit: srcBybit, okx: srcOkx }),
          fetchEconomicCalendar(from, to),
        ])
        const events = eventsRes.status === 'fulfilled' ? eventsRes.value : []
        const updates = updatesRes.status === 'fulfilled' ? updatesRes.value : []
        const listings = listingsRes.status === 'fulfilled' ? listingsRes.value : []
        const econ = econRes.status === 'fulfilled' ? econRes.value : []
        const list = [...events, ...updates, ...listings, ...econ]
        list.sort((a,b)=> new Date(a.time).getTime() - new Date(b.time).getTime())
        if (mounted) setItems(list)
      } catch {
        if (mounted) setItems(seedEvents())
      } finally {
        if (mounted) setLoading(false)
      }
    }
    pull()
    reloadRef.current = pull
    return () => { mounted = false }
  }, [range])

  // periodic refresh (60s)
  React.useEffect(() => {
    const id = setInterval(() => reloadRef.current(), 60_000)
    return () => clearInterval(id)
  }, [])

  const filtered = React.useMemo(() => {
    const now = new Date()
    const end = new Date(now)
    if (range === 'TODAY') end.setDate(now.getDate() + 1)
    else if (range === 'WEEK') end.setDate(now.getDate() + 7)
    else end.setMonth(now.getMonth() + 1)

    let list = items.filter((e) => {
      const ts = new Date(e.time).getTime()
      return ts >= now.getTime() && ts <= end.getTime()
    })
    if (category !== 'ALL') list = list.filter((e) => e.category === category)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
    }
    return list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }, [items, category, range, query])

  // infinite scroll
  React.useEffect(() => { setVisible(PAGE_SIZE) }, [category, range, query])
  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setVisible(v => Math.min(v + PAGE_SIZE, filtered.length))
    })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length])

  return (
    <section className="space-y-6">
      <Card className="bg-[#121212] border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>일정</CardTitle>
              <CardDescription>에어드랍 · 상장 · 경제지표</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
                <button onClick={() => setRange('TODAY')} className={`px-3 py-1.5 text-sm ${range === 'TODAY' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>오늘</button>
                <button onClick={() => setRange('WEEK')} className={`px-3 py-1.5 text-sm ${range === 'WEEK' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>1주</button>
                <button onClick={() => setRange('MONTH')} className={`px-3 py-1.5 text-sm ${range === 'MONTH' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>1개월</button>
              </div>
              <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
                <button onClick={() => setZone('LOCAL')} className={`px-3 py-1.5 text-sm ${zone === 'LOCAL' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>로컬</button>
                <button onClick={() => setZone('UTC')} className={`px-3 py-1.5 text-sm ${zone === 'UTC' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}>UTC</button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden">
              {(['ALL','AIRDROP','LISTING','ECON','OTHER'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setCategory(k as any)}
                  className={`px-3 py-1.5 text-sm ${category === k ? 'bg-emerald-600/20 text-emerald-300' : 'bg-[#1a1a1a] hover:bg-[#1e1e1e]'}`}
                >
                  {k === 'ALL' ? '전체' : k === 'AIRDROP' ? '에어드랍' : k === 'LISTING' ? '상장' : k === 'ECON' ? '경제지표' : '기타'}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색 (예: BTC, CPI)"
              className="px-3 py-2 rounded border border-neutral-700 bg-[#1a1a1a] text-sm flex-1 min-w-[160px]"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={srcBinance} onChange={(e)=>setSrcBinance(e.target.checked)} />Binance</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={srcBybit} onChange={(e)=>setSrcBybit(e.target.checked)} />Bybit</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={srcOkx} onChange={(e)=>setSrcOkx(e.target.checked)} />OKX</label>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
                    <div className="space-y-2 w-full">
                      <div className="h-4 w-40 bg-neutral-800 rounded" />
                      <div className="h-3 w-3/4 bg-neutral-800 rounded" />
                      <div className="h-3 w-1/2 bg-neutral-800 rounded" />
                    </div>
                    <div className="shrink-0 w-24 h-4 bg-neutral-800 rounded" />
                  </div>
                ))
              : filtered.length === 0
              ? (
                  <div className="text-sm text-muted-foreground">표시할 일정이 없습니다.</div>
                )
              : (
                  filtered.slice(0, visible).map((e) => (
                    <ListItemCard
                      key={e.id}
                      title={e.title}
                      description={e.description}
                      metaLeft={`${fmtTime(e.time, zone)} · ${labelCategory(e.category)}`}
                      rightSlot={
                        <span className={`inline-flex items-center gap-2 ${e.importance === 3 ? 'text-emerald-400' : e.importance === 2 ? 'text-gray-300' : 'text-gray-500'}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${e.importance === 3 ? 'bg-emerald-500' : e.importance === 2 ? 'bg-neutral-500' : 'bg-neutral-700'}`} />
                          <span className="hidden sm:inline text-xs">{e.source || ''}</span>
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded border border-neutral-700 text-xs hover:bg-[#1e1e1e]">원문</a>
                          ) : null}
                        </span>
                      }
                    />
                  ))
                )}
          </div>
          <div ref={sentinelRef} />
          {visible < filtered.length ? (
            <div className="mt-3 flex justify-center">
              <button onClick={()=>setVisible(v=>Math.min(v+PAGE_SIZE, filtered.length))} className="px-3 py-1 rounded border border-neutral-700 bg-[#1a1a1a] hover:bg-[#1e1e1e] text-sm">더 보기</button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}

function labelCategory(c: Category) {
  return c === 'AIRDROP' ? '에어드랍' : c === 'LISTING' ? '상장' : c === 'ECON' ? '경제지표' : '기타'
}
function fmtTime(iso: string, zone: 'LOCAL' | 'UTC') {
  const d = new Date(iso)
  const opt: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
  return zone === 'UTC'
    ? new Intl.DateTimeFormat('ko-KR', { ...opt, timeZone: 'UTC' }).format(d) + ' UTC'
    : new Intl.DateTimeFormat('ko-KR', opt).format(d)
}
function computeRange(r: 'TODAY'|'WEEK'|'MONTH') {
  const now = new Date()
  const from = fmtDateYYYYMMDD(now)
  const end = new Date(now)
  if (r==='TODAY') end.setDate(now.getDate()+1)
  else if (r==='WEEK') end.setDate(now.getDate()+7)
  else end.setMonth(now.getMonth()+1)
  const to = fmtDateYYYYMMDD(end)
  return { from, to }
}
function fmtDateYYYYMMDD(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth()+1).padStart(2,'0')
  const da = String(d.getUTCDate()).padStart(2,'0')
  return `${y}-${m}-${da}`
}
async function fetchCoingeckoEvents(from: string, to: string): Promise<EventItem[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/events?from_date=${from}&to_date=${to}`
    const j = await fetchJsonWithFallback(url, 8000)
    const data: any[] = j?.data || []
    return data.map((e: any, idx: number): EventItem => {
      const title = String(e.title || e.name || 'Event')
      const desc = String(e.description || '')
      const start = e?.start_date || e?.start_date?.utc || e?.created_at || new Date().toISOString()
      const cat = normalizeCategoryFromText(String(e?.type || ''), title+ ' ' + desc)
      return {
        id: `cg-e-${idx}-${e?.id || e?.screenshot || Math.random()}`,
        title,
        description: desc,
        category: cat,
        time: new Date(start).toISOString(),
        source: e?.website || e?.organizer || 'CoinGecko',
        importance: e?.is_conference ? 2 : 1,
      }
    })
  } catch { return [] }
}
async function fetchCoingeckoStatusUpdates(): Promise<EventItem[]> {
  try {
    const j = await fetchJsonWithFallback('https://api.coingecko.com/api/v3/status_updates?per_page=100&page=1', 8000)
    const arr: any[] = j?.status_updates || []
    return arr.map((u: any, i: number): EventItem => {
      const project = u?.project?.name || u?.project?.symbol || 'Project'
      const title = u?.category === 'exchange_listing' ? `${project} 거래소 상장 공지` : `${project} 업데이트`
      const desc = String(u?.description || '')
      const cat = normalizeCategoryFromStatus(String(u?.category || ''), title + ' ' + desc)
      const t = u?.created_at || new Date().toISOString()
      return {
        id: `cg-s-${i}-${u?.id || Math.random()}`,
        title,
        description: desc,
        category: cat,
        time: new Date(t).toISOString(),
        source: u?.user || 'CoinGecko',
        importance: u?.pin === true || u?.is_major ? 3 : 2,
      }
    })
  } catch { return [] }
}
function normalizeCategoryFromText(type: string, text: string): Category {
  const t = `${type} ${text}`.toLowerCase()
  if (t.includes('listing') || t.includes('상장')) return 'LISTING'
  if (t.includes('airdrop') || (t.includes('배포') && t.includes('토큰'))) return 'AIRDROP'
  if (t.includes('cpi') || t.includes('pce') || t.includes('gdp') || t.includes('fomc')) return 'ECON'
  return 'OTHER'
}
function normalizeCategoryFromStatus(cat: string, text: string): Category {
  const c = String(cat || '').toLowerCase()
  if (c.includes('exchange_listing')) return 'LISTING'
  return normalizeCategoryFromText(c, text)
}
function seedEvents(): EventItem[] {
  const base = Date.now()
  const add = (h: number) => new Date(base + h * 3600 * 1000).toISOString()
  return [
    { id: 'e1', title: 'BTC L2 프로젝트 에어드랍 스냅샷', description: '지갑 잔고 기준 스냅샷 진행', category: 'AIRDROP', time: add(8), source: 'project.io', importance: 3 },
    { id: 'e2', title: '새 토큰 거래소 상장', description: '주요 거래소 동시 상장 예정', category: 'LISTING', time: add(12), source: 'Exchange', importance: 3 },
    { id: 'e3', title: '미국 CPI 발표', description: '핵심 CPI 전월 대비', category: 'ECON', time: add(24), source: 'BLS', importance: 3 },
    { id: 'e4', title: '프로토콜 거버넌스 투표 마감', description: '제안 #42 투표 마감', category: 'OTHER', time: add(30), source: 'Snapshot', importance: 2 },
    { id: 'e5', title: 'ETH 네트워크 업그레이드', description: '하드포크 네트워크 업그레이드', category: 'OTHER', time: add(48), source: 'Ethereum', importance: 2 },
    { id: 'e6', title: '소프트웨어 월간 리포트 발표', description: '월간 개발 리포트', category: 'OTHER', time: add(72), source: 'Dev Team', importance: 1 },
  ]
}

// Exchange announcements via proxy or AllOrigins
async function fetchExchangeListings(opts: { binance: boolean; bybit: boolean; okx: boolean }): Promise<EventItem[]> {
  const out: EventItem[] = []
  try { if (opts.okx) out.push(...await fetchOkxAnnouncements()) } catch {}
  try { if (opts.binance) out.push(...await fetchBinanceListings()) } catch {}
  try { if (opts.bybit) out.push(...await fetchBybitAnnouncements()) } catch {}
  return out
}
async function fetchOkxAnnouncements(): Promise<EventItem[]> {
  const xml = await fetchTextThroughProxy('https://www.okx.com/rss/announcements', 8000)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item')).slice(0, 50)
  return items.map((it, i): EventItem => {
    const title = it.querySelector('title')?.textContent || 'OKX 공지'
    const pub = it.querySelector('pubDate')?.textContent || new Date().toISOString()
    const iso = new Date(pub).toISOString()
    const cat = /list|상장|listing/i.test(title) ? 'LISTING' : 'OTHER'
    const link = it.querySelector('link')?.textContent || 'https://www.okx.com/announcements'
    return { id: `okx-${i}-${iso}`, title, description: '', category: cat, time: iso, source: 'OKX', importance: cat==='LISTING'?3:2, url: link }
  })
}
async function fetchBinanceListings(): Promise<EventItem[]> {
  const u = 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageSize=50&pageNo=1'
  try {
    const txt = await fetchTextThroughProxy(u, 8000)
    const j = JSON.parse(txt)
    const arr: any[] = j?.data?.articles || []
    return arr.map((a: any, i: number): EventItem => {
      const title = String(a?.title || 'Binance 공지')
      const t = new Date(a?.releaseDate || Date.now()).toISOString()
      const cat = /list|상장|listing/i.test(title) ? 'LISTING' : 'OTHER'
      const slug = a?.code || a?.id || ''
      const url = slug ? `https://www.binance.com/en/support/announcement/${encodeURIComponent(String(slug))}` : 'https://www.binance.com/en/support/announcement'
      return { id: `bin-${i}-${a?.id || Math.random()}`, title, description: '', category: cat, time: t, source: 'Binance', importance: cat==='LISTING'?3:2, url }
    })
  } catch { return [] }
}
async function fetchBybitAnnouncements(): Promise<EventItem[]> {
  const u = 'https://announcements.bybit.com/api/web/announcements?locale=en-US&category=all&page_size=50&page=1'
  try {
    const txt = await fetchTextThroughProxy(u, 8000)
    const j = JSON.parse(txt)
    const arr: any[] = j?.result?.list || []
    return arr.map((a: any, i: number): EventItem => {
      const title = String(a?.title || 'Bybit 공지')
      const t = new Date(((a?.updated_at || a?.created_at) ? ((a?.updated_at || a?.created_at) * 1000) : Date.now())).toISOString()
      const cat = /list|상장|listing/i.test(title) ? 'LISTING' : 'OTHER'
      const url = a?.web_url || a?.url || 'https://announcements.bybit.com/'
      return { id: `byb-${i}-${a?.id || Math.random()}`, title, description: '', category: cat, time: t, source: 'Bybit', importance: cat==='LISTING'?3:2, url }
    })
  } catch { return [] }
}
async function fetchTextThroughProxy(url: string, timeoutMs = 8000): Promise<string> {
  // Prefer proxy first to avoid CORS console noise, then try direct
  try {
    const jin = await fetchWithTimeout(`https://r.jina.ai/http/${url.replace(/^https?:\/\//,'')}`, timeoutMs)
    if (jin.ok) return await jin.text()
  } catch {}
  try {
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const pr = await fetchWithTimeout(proxied, timeoutMs)
    if (pr.ok) return await pr.text()
  } catch {}
  const r = await fetchWithTimeout(url, timeoutMs)
  if (!r.ok) throw new Error('proxy failed')
  return await r.text()
}

// Economic calendar with TradingEconomics (optional key)
async function fetchEconomicCalendar(from: string, to: string): Promise<EventItem[]> {
  const key = (typeof process !== 'undefined' ? (process as any).env?.NEXT_PUBLIC_TE_API_KEY : undefined) || (globalThis as any)?.NEXT_PUBLIC_TE_API_KEY
  if (!key) return []
  try {
    const url = `https://api.tradingeconomics.com/calendar?d1=${from}&d2=${to}&c=United%20States&format=json&apikey=${encodeURIComponent(key)}`
    const arr: any[] = await fetchJsonWithFallback(url, 8000)
    return arr.slice(0, 100).map((e: any, i: number): EventItem => {
      const title = `${e?.Country || 'US'} ${e?.Category || e?.Event || 'Economic'} ${e?.Reference || ''}`.trim()
      const t = new Date(e?.DateUtc || e?.Date || Date.now()).toISOString()
      return { id: `econ-${i}-${e?.Id || Math.random()}`, title, description: e?.Event || e?.Actual || '', category: 'ECON', time: t, source: 'TradingEconomics', importance: 3 }
    })
  } catch { return [] }
}

// fetch with timeout to avoid hanging forever
function fetchWithTimeout(input: RequestInfo | URL, timeoutMs = 8000, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...(init||{}), signal: controller.signal }).finally(() => clearTimeout(id))
}

async function fetchJsonWithFallback(url: string, timeoutMs = 8000): Promise<any> {
  // Prefer proxies first to avoid CORS errors in dev
  try {
    const r = await fetchWithTimeout(`https://r.jina.ai/http/${url.replace(/^https?:\/\//,'')}`, timeoutMs)
    if (r.ok) { const txt = await r.text(); try { return JSON.parse(txt) } catch { /* fallthrough */ } }
  } catch {}
  try {
    const r = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeoutMs)
    if (r.ok) { const txt = await r.text(); try { return JSON.parse(txt) } catch { /* fallthrough */ } }
  } catch {}
  // direct last
  try {
    const r = await fetchWithTimeout(url, timeoutMs)
    if (r.ok) return await r.json()
  } catch {}
  return null
}
