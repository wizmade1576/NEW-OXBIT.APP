// src/components/trading/OrderBook.tsx
type OrderBookEntry = readonly [number, number]

type OrderBookProps = {
  asks: OrderBookEntry[]
  bids: OrderBookEntry[]
  price: number
  loading?: boolean
  onSelectPrice?: (price: number) => void
}

const formatPrice = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const formatSize = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })

export default function OrderBook({ asks, bids, price, loading, onSelectPrice }: OrderBookProps) {
  // 누적 depth (OKX 스타일)
  const askCum = (() => {
    let sum = 0
    return asks.map(([, q]) => (sum += q))
  })()
  const bidCum = (() => {
    let sum = 0
    return bids.map(([, q]) => (sum += q))
  })()

  const maxCum = Math.max(askCum.at(-1) ?? 0, bidCum.at(-1) ?? 0, 1)

  const Row = (entry: OrderBookEntry, type: 'ask' | 'bid', index: number) => {
    const [p, size] = entry
    const cum = type === 'ask' ? askCum[index] : bidCum[index]
    const width = Math.min(100, Math.max(0, (cum / maxCum) * 100))

    return (
      <button
        key={`${type}-${index}`}
        type="button"
        onClick={() => onSelectPrice?.(p)}
        className="group relative flex h-[18px] w-full items-center font-mono text-[13px] leading-none text-slate-200/90"
      >
        {/* depth bar */}
        <div
          className={
            'absolute inset-y-0 right-0 ' +
            (type === 'ask' ? 'bg-red-500/12' : 'bg-emerald-500/12')
          }
          style={{ width: `${width}%` }}
        />
        {/* hover */}
        <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-white/3" />

        {/* price */}
        <div className="relative z-10 w-[30px] pl-2 tabular-nums">
          <span className={type === 'ask' ? 'text-red-400' : 'text-emerald-400'}>
            {formatPrice(p)}
          </span>
        </div>

        {/* amount */}
        <div className="relative z-10 flex-1 pr-2 text-right text-slate-300/80 tabular-nums">
          {formatSize(size)}
        </div>
      </button>
    )
  }

  return (
    <section className="h-full min-h-0 overflow-hidden flex flex-col">
      {/* 내부 헤더(패널 헤더와 겹치지 않게 작게) */}
      <div className="px-1 pb-2">
        <div className="flex items-center justify-between text-[11px] text-slate-300/90">
          <span className="font-semibold">Order Book</span>
          <span className="font-mono tabular-nums">
            {price ? formatPrice(price) : '--'} <span className="text-slate-500">USDT</span>
          </span>
        </div>
        <div className="mt-2 h-px bg-slate-800/70" />
        <div className="mt-2 flex items-center text-[10px] text-slate-500">
          <div className="w-[88px] pl-2">Price</div>
          <div className="flex-1 pr-2 text-right">Amount</div>
        </div>
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <div className="px-1">{asks.map((e, i) => Row(e, 'ask', i))}</div>

        {/* mark bar (OKX 느낌) */}
        <div className="my-3 rounded-xl border border-slate-800/70 bg-slate-900/35 px-3 py-[6px]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Mark Price</span>
            <span className="font-mono tabular-nums text-slate-100">
              {price ? formatPrice(price) : '--'} <span className="text-slate-500">USDT</span>
            </span>
          </div>
        </div>

        <div className="px-1">{bids.map((e, i) => Row(e, 'bid', i))}</div>

        {loading ? (
          <div className="mt-3 text-center text-[11px] text-slate-500">Loading order book...</div>
        ) : null}
      </div>
    </section>
  )
}
