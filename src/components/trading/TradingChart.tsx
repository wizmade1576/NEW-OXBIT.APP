// src/components/trading/TradingChart.tsx
import { useEffect, useMemo, useRef } from 'react'

type Props = {
  symbol: 'BTCUSDT' | 'ETHUSDT'
}

export default function TradingChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const tvSymbol = useMemo(() => {
    return symbol === 'BTCUSDT' ? 'BINANCE:BTCUSDT.P' : 'BINANCE:ETHUSDT.P'
  }, [symbol])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // 심볼 바뀔 때마다 깨끗하게 다시 렌더
    el.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true

    // ✅ 여기 옵션이 “진짜로” 먹는다 (문서에 hide_side_toolbar 존재) :contentReference[oaicite:1]{index=1}
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '15',
      timezone: 'Asia/Seoul',
      theme: 'dark',
      style: '1',
      locale: 'en',

      // ✅ 핵심: 왼쪽 드로잉 툴바 숨김
      hide_side_toolbar: true,

      // 상단 툴바 유지 (원하면 true로 숨길 수 있음)
      withdateranges: true,
      allow_symbol_change: false,
      save_image: false,

      // 배경/패널 톤
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
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
