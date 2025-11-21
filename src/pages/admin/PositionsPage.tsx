import * as React from 'react'
import getSupabase from '../../lib/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

const TV_SCRIPT_URL = 'https://s3.tradingview.com/tv.js'
const TV_DEFAULT_SYMBOL = 'BINANCE:BTCUSDT'
const PRESET_SYMBOLS = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'BINANCE:SOLUSDT',
  'BINANCE:XRPUSDT',
  'BINANCE:BNBUSDT',
  'BINANCE:DOGEUSDT',
  'BINANCE:ADAUSDT',
  'BINANCE:AVAXUSDT',
  'BINANCE:TRXUSDT',
  'BINANCE:DOTUSDT',
]

const normalizeTvSymbol = (value?: string | null) => {
  if (!value) return TV_DEFAULT_SYMBOL
  if (value.includes(':')) return value.toUpperCase()
  return `BINANCE:${value.toUpperCase()}`
}

const formatPriceLabel = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '--'
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const formatPnlLabel = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '--'
  const num = Number(value)
  const formatted = num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return `${num >= 0 ? '+' : ''}${formatted}`
}

type PositionRecord = {
  id: string
  nickname: string | null
  profile_url?: string | null
  symbol: string
  direction: 'long' | 'short'
  leverage?: number
  amount?: number
  entry_price?: number
  current_price?: number
  liquidation_price?: number
  pnl_usd?: number
  pnl_krw?: number
  status?: 'on' | 'off'
  updated_at: string
  created_at: string
}

type FormState = {
  nickname: string
  profile_url: string
  symbol: string
  direction: 'long' | 'short'
  leverage: number
  amount: number
  entry_price: number
  current_price: number
  liquidation_price: number
  pnl_usd: number
  pnl_krw: number
  status: 'on' | 'off'
}

const createEmptyForm = (): FormState => ({
  nickname: '',
  profile_url: '',
  symbol: 'BTCUSDT',
  direction: 'long',
  leverage: 1,
  amount: 0,
  entry_price: 0,
  current_price: 0,
  liquidation_price: 0,
  pnl_usd: 0,
  pnl_krw: 0,
  status: 'on',
})

export default function PositionsPage() {
  const [positions, setPositions] = React.useState<PositionRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [onlyOn, setOnlyOn] = React.useState(false)
  const [selected, setSelected] = React.useState<PositionRecord | null>(null)
  const [form, setForm] = React.useState<FormState>(createEmptyForm)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const [profileInputMode, setProfileInputMode] = React.useState<'url' | 'file'>('url')
  const [submitting, setSubmitting] = React.useState(false)

  const [chartSymbol, setChartSymbol] = React.useState<string>(TV_DEFAULT_SYMBOL)
  const [tvScriptLoaded, setTvScriptLoaded] = React.useState(false)
  const [chartReady, setChartReady] = React.useState(false)

  const widgetContainerRef = React.useRef<HTMLDivElement | null>(null)
  const widgetRef = React.useRef<any>(null)
  const chartRef = React.useRef<any>(null)
  const overlayLinesRef = React.useRef<Map<string, any>>(new Map())
  const readyTimeoutRef = React.useRef<number | null>(null)

  const fetchPositions = React.useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    try {
      let query = supabase.from('positions').select('*').order('updated_at', { ascending: false })
      if (onlyOn) query = query.eq('status', 'on')
      if (search.trim()) {
        const keyword = `%${search.trim()}%`
        query = query.ilike('nickname', keyword).or(`symbol.ilike.${keyword}`)
      }
      const { data, error } = await query
      if (error) throw error
      setPositions(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [onlyOn, search])

  React.useEffect(() => {
    fetchPositions()
    const supabase = getSupabase()
    if (!supabase) return
    const channel = supabase.channel('admin_positions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () => {
        fetchPositions()
      })
      .subscribe()
    return () => channel?.unsubscribe?.()
  }, [fetchPositions])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).TradingView) {
      setTvScriptLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = TV_SCRIPT_URL
    script.async = true
    script.onload = () => setTvScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  React.useEffect(() => {
    if (!tvScriptLoaded) return
    const container = widgetContainerRef.current
    if (!container) return
    container.innerHTML = ''
    setChartReady(false)
    try {
      const widget = new (window as any).TradingView.widget({
        container_id: 'positions-tv-chart',
        autosize: true,
        symbol: chartSymbol,
        interval: '60',
        timezone: 'Asia/Seoul',
        theme: 'dark',
        style: '1',
        locale: 'ko',
        hide_side_toolbar: true,
        allow_symbol_change: false,
      })
      widgetRef.current = widget
      const handleReady = () => {
        const chart = widget.activeChart?.() || widget.chart?.()
        chartRef.current = chart
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current)
          readyTimeoutRef.current = null
        }
        setChartReady(true)
      }
      widget.onChartReady(() => {
        handleReady()
      })
      readyTimeoutRef.current = window.setTimeout(() => {
        handleReady()
      }, 2000)
    } catch (error) {
      console.error(error)
    }
    return () => {
      overlayLinesRef.current.forEach((line) => line?.remove?.())
      overlayLinesRef.current.clear()
      widgetRef.current = null
      chartRef.current = null
      setChartReady(false)
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current)
        readyTimeoutRef.current = null
      }
    }
  }, [tvScriptLoaded])

  React.useEffect(() => {
    if (!chartReady || !widgetRef.current) return
    try {
      const tv = widgetRef.current
      const chart = (tv.activeChart?.() || tv.chart?.())
      chart?.setSymbol?.(chartSymbol, undefined)
    } catch (error) {
      console.error(error)
    }
  }, [chartReady, chartSymbol])

  React.useEffect(() => {
    overlayLinesRef.current.forEach((line) => line?.remove?.())
    overlayLinesRef.current.clear()
    if (!chartReady || !chartRef.current) return
    const relevant = positions.filter((pos) => normalizeTvSymbol(pos.symbol) === chartSymbol)
    relevant.forEach((pos) => {
      const priceValue = pos.current_price ?? pos.entry_price
      if (priceValue === undefined || priceValue === null) return
      const price = Number(priceValue)
      if (!Number.isFinite(price)) return
      const text = `[${pos.nickname ?? 'Unknown'} • ${pos.direction} × ${pos.leverage ?? 1} • ${pos.amount ?? 0}] entry ${formatPriceLabel(
        pos.entry_price,
      )} · current ${formatPriceLabel(pos.current_price)} · PnL ${formatPnlLabel(pos.pnl_usd)}`
      const line = chartRef.current.createPriceLine?.({
        price,
        color: pos.direction === 'long' ? '#10FF80' : '#FF4D4D',
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: text,
        text,
      })
      if (line) {
        overlayLinesRef.current.set(pos.id, line)
      }
    })
  }, [chartReady, chartSymbol, positions])

  const beginAdd = () => {
    setSelected(null)
    setForm(createEmptyForm())
    setAvatarPreview(null)
    setProfileInputMode('url')
  }

  const beginEdit = (pos: PositionRecord) => {
    setSelected(pos)
    setForm({
      nickname: pos.nickname || '',
      profile_url: pos.profile_url || '',
      symbol: pos.symbol,
      direction: pos.direction,
      leverage: pos.leverage ?? 1,
      amount: pos.amount ?? 0,
      entry_price: pos.entry_price ?? 0,
      current_price: pos.current_price ?? 0,
      liquidation_price: pos.liquidation_price ?? 0,
      pnl_usd: pos.pnl_usd ?? 0,
      pnl_krw: pos.pnl_krw ?? 0,
      status: pos.status || 'on',
    })
    setAvatarPreview(pos.profile_url || null)
    setProfileInputMode(pos.profile_url?.startsWith('data:') ? 'file' : 'url')
    setChartSymbol(normalizeTvSymbol(pos.symbol))
  }

  const handleSubmit = async () => {
    if (!form.nickname.trim() || !form.symbol.trim()) {
      return
    }
    const supabase = getSupabase()
    if (!supabase) return
    setSubmitting(true)
    const payload = {
      nickname: form.nickname.trim(),
      profile_url: form.profile_url ? form.profile_url : null,
      symbol: form.symbol.trim(),
      direction: form.direction,
      leverage: Number(form.leverage),
      amount: Number(form.amount),
      entry_price: Number(form.entry_price),
      current_price: Number(form.current_price),
      liquidation_price: Number(form.liquidation_price),
      pnl_usd: Number(form.pnl_usd),
      pnl_krw: Number(form.pnl_krw),
      status: form.status,
      updated_at: new Date().toISOString(),
    }
    try {
      if (selected) {
        await supabase.from('positions').update(payload).eq('id', selected.id)
      } else {
        await supabase.from('positions').insert(payload)
      }
      fetchPositions()
      beginAdd()
    } catch (error) {
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = positions.filter((p) => {
    if (!search.trim()) return true
    const keyword = search.trim().toLowerCase()
    return (p.nickname ?? '').toLowerCase().includes(keyword) || p.symbol.toLowerCase().includes(keyword)
  })

  const chartOptions = React.useMemo(() => {
    const dynamicSet = new Set<string>()
    positions.forEach((pos) => dynamicSet.add(normalizeTvSymbol(pos.symbol)))
    const combined = [...PRESET_SYMBOLS]
    dynamicSet.forEach((sym) => {
      if (!combined.includes(sym)) combined.push(sym)
    })
    return combined
  }, [positions])

  React.useEffect(() => {
    if (!chartOptions.includes(chartSymbol) && chartOptions.length) {
      setChartSymbol(chartOptions[0])
    }
  }, [chartOptions, chartSymbol])

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 pb-10 sm:px-0">
      <Card className="bg-[#111827] border border-border shadow-inner">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-white">실시간 포지션</CardTitle>
            <CardDescription>Supabase에서 읽은 포지션 데이터를 ON/OFF로 확인합니다.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="닉네임 또는 심볼 검색"
              className="rounded border border-neutral-700 bg-[#0f0f15] px-3 py-1.5 text-sm text-white placeholder:text-muted-foreground"
            />
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} />
              <span>ON만 보기</span>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center text-xs text-muted-foreground">불러오는 중...</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((pos) => (
                <div
                  key={pos.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-[#0f172a] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={pos.profile_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pos.nickname || 'User')}&background=1d2438&color=fff`}
                      alt={pos.nickname || 'User'}
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{pos.nickname || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{pos.symbol}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                        pos.direction === 'long'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {pos.direction}
                    </span>
                    <span className="text-white">{pos.leverage ? `${pos.leverage}x` : '-'}</span>
                    <span
                      className={
                        typeof pos.pnl_usd === 'number' && pos.pnl_usd >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      ${formatPnlLabel(pos.pnl_usd)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => beginEdit(pos)} className="text-xs text-amber-400 hover:underline">
                      수정
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-center text-xs text-muted-foreground">포지션이 없습니다.</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#111827] border border-border shadow-inner">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-white">TradingView 오버레이</CardTitle>
            <CardDescription>선택한 심볼에서 등록된 포지션을 가격 라벨로 표시합니다.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-[11px]">심볼</span>
            <select
              value={chartSymbol}
              onChange={(e) => setChartSymbol(e.target.value)}
              className="rounded border border-neutral-700 bg-[#0f0f15] px-2 py-1 text-[13px] text-white"
            >
                  {chartOptions.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym.includes(':') ? sym.split(':')[1] : sym}
                    </option>
                  ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[320px] sm:h-[520px]">
            <div id="positions-tv-chart" ref={widgetContainerRef} className="h-full w-full" />
            {!tvScriptLoaded && (
              <div className="absolute inset-0 grid place-items-center bg-[#0f0f15]/80 text-sm text-white">
                TradingView 스크립트 로딩 중...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-[#0f172a] p-6 shadow-xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">{selected ? '포지션 수정' : '신규 포지션 등록'}</CardTitle>
            <CardDescription>{selected ? '선택한 포지션 정보를 업데이트합니다.' : '실시간 포지션을 Supabase에 등록합니다.'}</CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={beginAdd}>
            새 등록
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-sm font-semibold text-white">사용자 정보</span>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-10 w-10 rounded-full border border-border bg-neutral-900 overflow-hidden">
                  <img
                    src={avatarPreview || form.profile_url || 'https://i.pravatar.cc/64'}
                    alt="avatar preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>프로필 이미지</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        const value = reader.result as string
                        setForm((prev) => ({ ...prev, profile_url: value }))
                        setAvatarPreview(value)
                        setProfileInputMode('file')
                      }
                      reader.readAsDataURL(file)
                    }}
                    className="block w-44 rounded border border-border bg-[#070a10] px-3 py-2 text-xs text-white"
                  />
                </label>
                {profileInputMode === 'file' && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileInputMode('url')
                      setForm((prev) => ({ ...prev, profile_url: '' }))
                      setAvatarPreview(null)
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    업로드 취소
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>닉네임</span>
                  <input
                    value={form.nickname}
                    onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                    className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>프로필 URL</span>
                  <input
                    value={profileInputMode === 'url' ? form.profile_url : ''}
                    onChange={(e) => {
                      if (profileInputMode !== 'url') setProfileInputMode('url')
                      setForm((prev) => ({ ...prev, profile_url: e.target.value }))
                      setAvatarPreview(e.target.value || null)
                    }}
                    className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                    disabled={profileInputMode === 'file'}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    파일 업로드 후에는 URL 대신 업로드한 이미지가 사용됩니다.
                  </p>
                </label>
              </div>
            </div>
          </section>

        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-border bg-neutral-900 overflow-hidden">
              <img
                src={avatarPreview || form.profile_url || 'https://i.pravatar.cc/64'}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            </div>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>프로필 이미지 파일</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const value = reader.result as string
                    setForm((prev) => ({ ...prev, profile_url: value }))
                    setAvatarPreview(value)
                  }
                  reader.readAsDataURL(file)
                }}
                className="block w-44 rounded border border-border bg-[#070a10] px-3 py-2 text-xs text-white"
              />
            </label>
          </div>
        </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-sm font-semibold text-white">포지션 정보</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>심볼</span>
                <input
                  value={form.symbol}
                  onChange={(e) => setForm((prev) => ({ ...prev, symbol: e.target.value }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>방향</span>
                <select
                  value={form.direction}
                  onChange={(e) => setForm((prev) => ({ ...prev, direction: e.target.value as 'long' | 'short' }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>레버리지</span>
                <input
                  type="number"
                  value={form.leverage}
                  onChange={(e) => setForm((prev) => ({ ...prev, leverage: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>수량</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>진입가</span>
                <input
                  type="number"
                  value={form.entry_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, entry_price: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>현재가</span>
                <input
                  type="number"
                  value={form.current_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, current_price: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>청산가</span>
                <input
                  type="number"
                  value={form.liquidation_price}
                  onChange={(e) => setForm((prev) => ({ ...prev, liquidation_price: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-sm font-semibold text-white">손익 정보</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>P&L (USD)</span>
                <input
                  type="number"
                  value={form.pnl_usd}
                  onChange={(e) => setForm((prev) => ({ ...prev, pnl_usd: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>P&L (KRW)</span>
                <input
                  type="number"
                  value={form.pnl_krw}
                  onChange={(e) => setForm((prev) => ({ ...prev, pnl_krw: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>상태</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'on' | 'off' }))}
                  className="w-full rounded-md border border-border bg-[#070a10] px-3 py-2 text-sm text-white"
                >
                  <option value="on">ON</option>
                  <option value="off">OFF</option>
                </select>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                beginAdd()
              }}
            >
              취소
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.nickname.trim() || !form.symbol.trim()}>
              {submitting ? '저장 중…' : selected ? '수정 저장' : '등록'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
