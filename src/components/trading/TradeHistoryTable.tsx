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
  close: '종료',
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

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return value
  }
}

function typeBadgeClass(type: TradeRecord['type']) {
  // OKX 톤: open/tp=green, close=gray, sl/liq=red
  if (type === 'open' || type === 'tp') return 'border-[#16c784] text-[#16c784]'
  if (type === 'close') return 'border-[#3a3f46] text-[#c8d0d8]'
  return 'border-[#ea3943] text-[#ea3943]'
}

type Props = {
  trades: TradeRecord[]
}

export default function TradeHistoryTable({ trades }: Props) {
  return (
    <section className="min-h-0 w-full">
      {/* OKX: 섹션 타이틀은 부모(PaperTrade)에서 이미 처리하므로 여기선 제거 */}
      <div className="min-h-0 w-full overflow-x-auto">
        <table className="w-full table-fixed text-[12px]">
          <thead className="sticky top-0 z-10 bg-black">
            <tr className="border-b border-[#1f2329] text-[#9aa4ad]">
              <th className="w-[160px] px-3 py-3 text-left font-semibold">Time</th>
              <th className="w-[120px] px-3 py-3 text-left font-semibold">Type</th>
              <th className="w-[140px] px-3 py-3 text-left font-semibold">Symbol</th>
              <th className="px-3 py-3 text-right font-semibold">Price</th>
              <th className="w-[110px] px-3 py-3 text-right font-semibold">Size</th>
              <th className="w-[80px] px-3 py-3 text-right font-semibold">Lev</th>
              <th className="w-[140px] px-3 py-3 text-right font-semibold">PnL</th>
            </tr>
          </thead>

          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[#9aa4ad]">
                  체결 내역이 없습니다.
                </td>
              </tr>
            ) : (
              trades.map(trade => {
                const pnlColor = trade.pnl >= 0 ? 'text-[#16c784]' : 'text-[#ea3943]'
                return (
                  <Fragment key={trade.id}>
                    <tr className="border-b border-[#1f2329] hover:bg-[#0b0e11]">
                      {/* Time: OKX처럼 시간+날짜 2줄 */}
                      <td className="px-3 py-4 align-middle">
                        <div className="text-white font-semibold">{formatTime(trade.created_at)}</div>
                        <div className="mt-1 text-[11px] text-[#9aa4ad]">{formatDate(trade.created_at)}</div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        <span
                          className={
                            'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ' +
                            typeBadgeClass(trade.type)
                          }
                        >
                          {TYPE_LABEL[trade.type]}
                        </span>
                      </td>

                      <td className="px-3 py-4 align-middle text-white font-semibold">
                        {trade.symbol}
                      </td>

                      <td className="px-3 py-4 align-middle text-right text-white">
                        {trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        <span className="text-[#9aa4ad] text-[11px]">USDT</span>
                      </td>

                      <td className="px-3 py-4 align-middle text-right text-white">
                        {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>

                      <td className="px-3 py-4 align-middle text-right text-white">
                        {trade.leverage}x
                      </td>

                      <td className={'px-3 py-4 align-middle text-right font-semibold ' + pnlColor}>
                        {(trade.pnl >= 0 ? '+' : '') +
                          trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
