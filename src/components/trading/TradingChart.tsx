import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  symbol: 'BTCUSDT' | 'ETHUSDT'
  entryPrice?: number | null
  entrySide?: 'long' | 'short' | null
  markPrice?: number
}

type TradingViewWindow = Window & typeof globalThis & { TradingView?: any }

let tradingViewScriptPromise: Promise<any> | null = null

const loadTradingViewScript = () => {
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  const win = window as TradingViewWindow
  if (win.TradingView) return Promise.resolve(win.TradingView)
  if (tradingViewScriptPromise) return tradingViewScriptPromise

  tradingViewScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('tv-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(win.TradingView), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'tv-script'
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => resolve(win.TradingView)
    script.onerror = () => reject(new Error('TradingView script failed to load'))
    document.head.appendChild(script)
  })

  return tradingViewScriptPromise
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

export default function TradingChart({ symbol, entryPrice, entrySide }: Props) {
  const containerIdRef = useMemo(() => `tradingview-chart-${Math.random().toString(36).slice(2)}`, [])
  const [chartReady, setChartReady] = useState(false)
  const [entryPercent, setEntryPercent] = useState<number | null>(null)
  const chartRef = useRef<any | null>(null)
  const widgetRef = useRef<any | null>(null)
  const entryLineRef = useRef<any | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const entryPriceRef = useRef<number | null | undefined>(entryPrice)

  const tvSymbol = useMemo(() => (symbol === 'BTCUSDT' ? 'BINANCE:BTCUSDT.P' : 'BINANCE:ETHUSDT.P'), [symbol])

  useEffect(() => {
    let cancelled = false
    let widgetInstance: any | null = null

    const setup = async () => {
      const TradingView = await loadTradingViewScript()
      if (cancelled) return
      const container = document.getElementById(containerIdRef)
      if (!container || !TradingView) return

      widgetInstance = new TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: '15',
        timezone: 'Asia/Seoul',
        theme: 'dark',
        style: '1',
        locale: 'en',
        hide_side_toolbar: true,
        withdateranges: true,
        allow_symbol_change: false,
        save_image: false,
        backgroundColor: '#000000',
        gridColor: 'rgba(255, 255, 255, 0.06)',
        container_id: containerIdRef,
      })

      widgetRef.current = widgetInstance
    widgetInstance.onChartReady(() => {
      if (cancelled) return
      chartRef.current = widgetInstance.chart()
      setChartReady(true)
    })
    }

    setup()

    return () => {
      cancelled = true
      entryLineRef.current?.remove?.()
      entryLineRef.current = null
      try {
        if (widgetInstance && typeof widgetInstance.remove === 'function') {
          widgetInstance.remove()
        }
      } catch (error) {
        console.warn('TradingView widget remove failed', error)
      }
      widgetRef.current = null
      chartRef.current = null
      setChartReady(false)
    }
  }, [tvSymbol, containerIdRef])

  useEffect(() => {
    if (!chartReady || !chartRef.current || entryPrice == null) {
      setEntryPercent(null)
      return
    }
    if (entryLineRef.current) {
      entryLineRef.current.remove?.()
      entryLineRef.current = null
    }

    const chart = chartRef.current
    const color = entrySide === 'long' ? '#16c784' : '#ff5555'
    const now = Math.floor(Date.now() / 1000)
    const formattedPrice = entryPrice.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    entryLineRef.current = chart.createMultipointShape(
      [
        { time: now, price: entryPrice },
        { time: now + 1, price: entryPrice },
      ],
      {
        shape: 'horizontal_line',
        text: `Entry ${formattedPrice}`,
        overrides: {
          linecolor: color,
          linewidth: 2,
          linestyle: 0,
          textcolor: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderradius: 2,
        },
        disableSelection: true,
        lock: true,
        disableSave: true,
        hidePriceLine: false,
      },
    )
  }, [chartReady, entryPrice, entrySide])

  const updateEntryPercent = useCallback(() => {
    const chart = chartRef.current
    const price = entryPriceRef.current
    const wrapper = wrapperRef.current
    if (!chart || price == null || !wrapper) {
      setEntryPercent(null)
      return
    }
    const height = wrapper.clientHeight
    if (height <= 0) {
      setEntryPercent(null)
      return
    }
    const priceScale =
      typeof chart.priceScale === 'function' ? chart.priceScale('right') : null
    const coordinate =
      priceScale && typeof priceScale.priceToCoordinate === 'function'
        ? priceScale.priceToCoordinate(price)
        : null
    if (coordinate == null || Number.isNaN(coordinate)) {
      setEntryPercent(null)
      return
    }
    setEntryPercent(clampPercent((coordinate / height) * 100))
  }, [])

  useEffect(() => {
    entryPriceRef.current = entryPrice ?? null
    updateEntryPercent()
  }, [entryPrice, updateEntryPercent])

  useEffect(() => {
    const handleResize = () => updateEntryPercent()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateEntryPercent])

  useEffect(() => {
    if (!chartReady || !chartRef.current) {
      return
    }
    updateEntryPercent()

    const chart = chartRef.current
    const priceScale =
      typeof chart.priceScale === 'function' ? chart.priceScale('right') : null
    const priceScaleSub =
      priceScale && typeof priceScale.subscribeVisibleRangeChange === 'function'
        ? priceScale.subscribeVisibleRangeChange(() => updateEntryPercent())
        : null
    const timeScale = typeof chart.timeScale === 'function' ? chart.timeScale() : null
    const timeScaleSub =
      timeScale && typeof timeScale.subscribeVisibleRangeChange === 'function'
        ? timeScale.subscribeVisibleRangeChange(() => updateEntryPercent())
        : null

    return () => {
      priceScaleSub?.()
      timeScaleSub?.()
    }
  }, [chartReady, updateEntryPercent])

  const labelColor = entrySide === 'long' ? '#16c784' : '#ff5555'
  const formattedLabel =
    entryPrice != null
      ? `Entry ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : ''

  return (
    <div ref={wrapperRef} className="relative h-full w-full min-h-0 overflow-hidden bg-black">
      <div id={containerIdRef} className="absolute inset-0 h-full w-full" />
      {entryPercent != null && entryPrice != null ? (
        <>
          <div
            className="pointer-events-none absolute left-0 right-0 z-10"
            style={{ top: `${entryPercent}%` }}
          >
            <div className="h-[1px] w-full" style={{ backgroundColor: labelColor }} />
          </div>
          <div
            className="pointer-events-none absolute left-0 right-0 z-20"
            style={{ top: `${entryPercent}%`, transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center justify-end gap-2 px-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em] rounded border border-white/10 bg-black/70 px-2 py-0.5"
                style={{ color: labelColor }}
              >
                {formattedLabel}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
