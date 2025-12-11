// src/components/trading/TradingChart.tsx
import { useEffect, useRef } from 'react'

type Props = {
  symbol: 'BTCUSDT' | 'ETHUSDT'
  price: number // props 시그니처 유지
}

declare global {
  interface Window {
    TradingView?: any
  }
}

export default function TradingChart({ symbol }: Props) {
  const containerIdRef = useRef(
    `tv_chart_${Math.random().toString(36).slice(2)}`
  )

  useEffect(() => {
    const containerId = containerIdRef.current

    const createWidget = () => {
      if (!window.TradingView) return

      // 기존 위젯 정리
      const el = document.getElementById(containerId)
      if (el) el.innerHTML = ''

      // ✅ 여기서 "선물" 심볼로 맞춘다 (Binance USDT Perpetual)
      const tvSymbol =
        symbol === 'BTCUSDT'
          ? 'BINANCE:BTCUSDT.P'
          : 'BINANCE:ETHUSDT.P'

      new window.TradingView.widget({
        width: '100%',
        height: 400,
        symbol: tvSymbol,
        interval: '1',          // 1분봉
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        hide_top_toolbar: false,
        hide_legend: false,
        container_id: containerId,
        withdateranges: true,
        enable_publishing: false,
      })
    }

    if (!window.TradingView) {
      const script = document.createElement('script')
      script.id = 'tradingview-widget-script'
      script.src = 'https://s3.tradingview.com/tv.js'
      script.type = 'text/javascript'
      script.async = true
      script.onload = createWidget
      document.head.appendChild(script)
    } else {
      createWidget()
    }

    return () => {
      const el = document.getElementById(containerId)
      if (el) el.innerHTML = ''
    }
  }, [symbol])

  return (
    <div className="w-full h-full">
      <div
        id={containerIdRef.current}
        className="w-full h-[400px] rounded-md border border-slate-800 bg-slate-950"
      />
    </div>
  )
}
