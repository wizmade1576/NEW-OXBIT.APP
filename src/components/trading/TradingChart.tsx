// src/components/trading/TradingChart.tsx
import { useEffect, useMemo, useRef } from 'react'

type Props = {
  symbol: 'BTCUSDT' | 'ETHUSDT'
}

export default function TradingChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mountedRef = useRef(false)

  const tvSymbol = useMemo(() => {
    return symbol === 'BTCUSDT' ? 'BINANCE:BTCUSDT.P' : 'BINANCE:ETHUSDT.P'
  }, [symbol])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // ✅ StrictMode(dev)에서 effect 2번 실행 방지 + 심볼 변경 시 정상 재렌더
    if (mountedRef.current) {
      el.innerHTML = ''
    }
    mountedRef.current = true

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
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
    })

    el.appendChild(script)

    return () => {
      // 언마운트 시 정리
      if (el) el.innerHTML = ''
    }
  }, [tvSymbol])

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
