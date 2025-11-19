import * as React from 'react'

export type Ticker = {
  label: string
  value: string
  change?: { dir: 'up' | 'down'; pct: string }
  extra?: string
}

const defaultTickers: Ticker[] = [
  { label: 'BTC', value: '$102,544.98', change: { dir: 'down', pct: '1.30%' } },
  { label: 'ETH', value: '$3,338.73', change: { dir: 'down', pct: '2.51%' } },
  { label: '김프', value: '', change: { dir: 'up', pct: '3.65%' }, extra: '5,413,735원' },
  { label: 'BTC 도미넌스', value: '59.93%' },
]

export default function TickerBar({
  items = defaultTickers,
  live = true,
  intervalMs = 4000,
  fetchUrl,
  wsUrl,
}: {
  items?: Ticker[]
  live?: boolean
  intervalMs?: number
  fetchUrl?: string
  wsUrl?: string
}) {
  const [data, setData] = React.useState<Ticker[]>(items)

  React.useEffect(() => setData(items), [items])

  React.useEffect(() => {
    if (!live || fetchUrl || wsUrl) return
    const id = window.setInterval(() => {
      setData((prev) =>
        prev.map((t) => {
          if (!t.change) return t
          const base = parseFloat(t.change.pct.replace('%', '')) * (t.change.dir === 'down' ? -1 : 1)
          const next = base + (Math.random() * 0.4 - 0.2)
          const dir: 'up' | 'down' = next >= 0 ? 'up' : 'down'
          const pct = `${Math.abs(next).toFixed(2)}%`
          return { ...t, change: { dir, pct } }
        })
      )
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [live, intervalMs, fetchUrl, wsUrl])

  React.useEffect(() => {
    if (!fetchUrl) return
    let active = true
    async function poll(url: string) {
      try {
        const res = await fetch(url)
        const json = await res.json()
        if (!active) return
        const next: Ticker[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : []
        if (next.length) setData(next)
      } catch {}
    }
    poll(fetchUrl)
    const id = window.setInterval(() => poll(fetchUrl), intervalMs)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [fetchUrl, intervalMs])

  React.useEffect(() => {
    if (!wsUrl) return
    const ws = new WebSocket(wsUrl)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data))
        const next: Ticker[] = Array.isArray(msg) ? msg : Array.isArray(msg?.items) ? msg.items : []
        if (next.length) setData(next)
      } catch {}
    }
    return () => ws.close()
  }, [wsUrl])

  function changeClass(t: Ticker) {
    if (!t.change) return ''
    return t.change.dir === 'up' ? 'text-destructive' : 'text-info'
  }

  return (
    <div className="w-full border-y border-border bg-background/60">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 py-2">
        <div className="flex items-center justify-center gap-3 sm:gap-6 md:gap-8 overflow-x-auto">
          {data.map((t, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
              <span className="font-semibold text-muted-foreground">{t.label}:</span>
              {t.value && <span className="font-medium">{t.value}</span>}
              {t.change && (
                <span className={changeClass(t)}>
                  {t.change.dir === 'up' ? '▲' : '▼'} {t.change.pct}
                </span>
              )}
              {t.extra && <span className="text-muted-foreground">{t.extra}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

