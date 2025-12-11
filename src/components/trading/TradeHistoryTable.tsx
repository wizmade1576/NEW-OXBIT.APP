import { Fragment } from 'react'

export type TradeRecord = {
  id: string
  user_id: string
  type: 'open' | 'close' | 'liq' | 'tp' | 'sl'
  symbol: 'BTCUSDT' | 'ETHUSDT'
  price: number
  amount: number
  leverage: number
  pnl: number
  created_at: string
}

const TYPE_LABEL: Record<TradeRecord['type'], string> = {
  open: '진입',
  close: '시장가 종료',
  liq: '청산',
  tp: 'TP',
  sl: 'SL',
}

const formatTime = (value: string) => {
  try {
    return new Date(value).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return value
  }
}

type Props = {
  trades: TradeRecord[]
}

export default function TradeHistoryTable({ trades }: Props) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-xs text-slate-300 shadow-xl shadow-slate-900/50">
      <header className="mb-4 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
        <span>체결 내역</span>
        <span className="text-[10px] text-slate-400">최근 30개</span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-auto text-[11px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <th className="px-2 py-2 text-left">시간</th>
              <th className="px-2 py-2 text-left">종류</th>
              <th className="px-2 py-2 text-left">심볼</th>
              <th className="px-2 py-2 text-right">가격</th>
              <th className="px-2 py-2 text-right">수량</th>
              <th className="px-2 py-2 text-right">레버리지</th>
              <th className="px-2 py-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-400">
                  체결 내역이 없습니다.
                </td>
              </tr>
            ) : (
              trades.map(trade => (
                <Fragment key={trade.id}>
                  <tr className="border-t border-slate-800">
                    <td className="px-2 py-2">{formatTime(trade.created_at)}</td>
                    <td className="px-2 py-2">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                        {TYPE_LABEL[trade.type]}
                      </span>
                    </td>
                    <td className="px-2 py-2">{trade.symbol}</td>
                    <td className="px-2 py-2 text-right">
                      {trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-2 py-2 text-right">{trade.leverage}x</td>
                    <td
                      className={`px-2 py-2 text-right ${
                        trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-500'
                      }`}
                    >
                      {(trade.pnl >= 0 ? '+' : '') +
                        trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
