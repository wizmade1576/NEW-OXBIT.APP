// src/components/trading/OrderBook.tsx
type OrderBookEntry = readonly [number, number]

type OrderBookProps = {
  asks: OrderBookEntry[]
  bids: OrderBookEntry[]
  price: number
  loading?: boolean
  // 🔹 호가 클릭 시 선택된 가격을 부모(예: PaperTrade / OrderForm)로 넘겨주는 콜백
  onSelectPrice?: (price: number) => void
}

const formatPrice = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatSize = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })

export default function OrderBook({ asks, bids, price, loading, onSelectPrice }: OrderBookProps) {
  const maxQty =
    Math.max(...asks.map(([, qty]) => qty), ...bids.map(([, qty]) => qty), 0) || 1

  const renderRow = (entry: OrderBookEntry, type: 'ask' | 'bid', index: number) => {
    const [priceValue, size] = entry
    const width = Math.min(100, Math.max(0, (size / maxQty) * 100))

    return (
      <div
        key={`${type}-${index}`}
        // 🔹 클릭 가능 + hover 스타일
        className="flex items-center justify-between rounded-xl px-2 py-1 text-xs font-mono text-slate-300 cursor-pointer hover:bg-slate-900/60"
        onClick={() => onSelectPrice?.(priceValue)}
      >
        <div className={`flex-1 ${type === 'ask' ? 'text-red-400' : 'text-emerald-400'}`}>
          {formatPrice(priceValue)}
        </div>
        <div className="relative mx-2 h-1 w-16 overflow-hidden rounded-full bg-slate-900">
          <div
            className={`absolute inset-y-0 ${
              type === 'ask' ? 'bg-red-500/70' : 'bg-emerald-500/80'
            }`}
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="w-16 text-right text-[11px] text-slate-400">
          {formatSize(size)}
        </div>
      </div>
    )
  }

  return (
    <section className="flex h-full flex-col justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-950 p-4 text-[13px]">
      <header className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-slate-500">
        <span>Order Book</span>
        <span className="text-base text-white">
          {price.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
        </span>
      </header>

      {/* 매도 */}
      <div className="space-y-1">
        <div className="text-[11px] uppercase text-slate-500">매도</div>
        {asks.length === 0 ? (
          <div className="text-center text-[11px] text-slate-500">로딩 중…</div>
        ) : (
          asks.map((entry, index) => renderRow(entry, 'ask', index))
        )}
      </div>

      <div className="border-t border-slate-900 pt-2 text-center text-[11px] text-slate-500">
        현재가
      </div>

      {/* 매수 */}
      <div className="space-y-1">
        <div className="text-[11px] uppercase text-slate-500">매수</div>
        {bids.length === 0 ? (
          <div className="text-center text-[11px] text-slate-500">로딩 중…</div>
        ) : (
          bids.map((entry, index) => renderRow(entry, 'bid', index))
        )}
      </div>

      {loading ? (
        <div className="mt-2 text-center text-[11px] text-slate-500">
          실시간 데이터 수신 중…
        </div>
      ) : null}
    </section>
  )
}
