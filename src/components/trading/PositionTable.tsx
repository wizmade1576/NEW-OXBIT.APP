import Button from '../../components/ui/Button'

export type PositionRow = {
  id: string
  user_id: string
  symbol: 'BTCUSDT' | 'ETHUSDT'
  side: 'long' | 'short'
  entry_price: number
  leverage: number
  amount: number
  margin: number
  liquidation_price: number
  take_profit: number | null
  stop_loss: number | null
}

type PositionTableProps = {
  position: PositionRow | null
  priceUSDT: number
  pnlUSDT: number
  pnlPercent: number
  onClose: () => void
}

export default function PositionTable({ position, priceUSDT, pnlUSDT, pnlPercent, onClose }: PositionTableProps) {
  if (!position) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
        현재 열린 포지션이 없습니다.
      </section>
    )
  }

  const directionColor = position.side === 'long' ? 'text-emerald-400' : 'text-red-400'
  const pnlColor = pnlUSDT >= 0 ? 'text-emerald-400' : 'text-red-500'

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 shadow-xl shadow-slate-900/60">
      <header className="mb-4 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
        <span>Open Position</span>
        <span className="text-[10px] text-slate-400">실시간 PnL</span>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <th className="pb-2">Symbol</th>
              <th className="pb-2">Side</th>
              <th className="pb-2">Quantity</th>
              <th className="pb-2">Entry</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">PnL</th>
              <th className="pb-2">ROE</th>
              <th className="pb-2">Liquidation</th>
              <th className="pb-2">TP / SL</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-800/60 text-sm text-white">
              <td className="py-3 font-semibold">{position.symbol}</td>
              <td className={`py-3 font-semibold ${directionColor}`}>{position.side.toUpperCase()}</td>
              <td className="py-3">{position.amount.toFixed(4)}</td>
              <td className="py-3">{position.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</td>
              <td className="py-3">{priceUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</td>
              <td className={`py-3 font-semibold ${pnlColor}`}>
                {pnlUSDT >= 0 ? '+' : ''}
                {pnlUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
              </td>
              <td className="py-3 font-semibold text-slate-300">
                {pnlPercent.toFixed(2)}%
              </td>
              <td className="py-3">{position.liquidation_price.toFixed(2)} USDT</td>
              <td className="py-3 space-y-1 text-[11px] text-slate-400">
                <div>TP: {position.take_profit ? `${position.take_profit.toFixed(2)} USDT` : '-'}</div>
                <div>SL: {position.stop_loss ? `${position.stop_loss.toFixed(2)} USDT` : '-'}</div>
              </td>
              <td className="py-3">
                <Button
                  onClick={onClose}
                  className="rounded-2xl border border-slate-700 bg-red-600/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200"
                >
                  시장가 종료
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
