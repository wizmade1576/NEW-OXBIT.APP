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

export default function PositionTable({
  position,
  priceUSDT,
  pnlUSDT,
  pnlPercent,
  onClose,
}: PositionTableProps) {
  if (!position) {
    return <div className="px-3 py-6 text-[#9aa4ad] text-[12px]">표시할 데이터가 없습니다.</div>
  }

  const sideColor = position.side === 'long' ? 'text-[#16c784]' : 'text-[#ea3943]'
  const pnlColor = pnlUSDT >= 0 ? 'text-[#16c784]' : 'text-[#ea3943]'

  return (
    <section className="min-h-0 w-full">
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed text-[12px]">
          <thead className="sticky top-0 z-10 bg-black">
            <tr className="border-b border-[#1f2329] text-[#9aa4ad]">
              <th className="w-[140px] px-3 py-3 text-left font-semibold">Symbol</th>
              <th className="w-[120px] px-3 py-3 text-left font-semibold">Side</th>
              <th className="w-[120px] px-3 py-3 text-right font-semibold">Size</th>
              <th className="px-3 py-3 text-right font-semibold">Entry</th>
              <th className="px-3 py-3 text-right font-semibold">Mark</th>
              <th className="w-[140px] px-3 py-3 text-right font-semibold">PnL</th>
              <th className="w-[90px] px-3 py-3 text-right font-semibold">ROE</th>
              <th className="px-3 py-3 text-right font-semibold">Liq</th>
              <th className="w-[160px] px-3 py-3 text-right font-semibold">TP/SL</th>
              <th className="w-[140px] px-3 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b border-[#1f2329] hover:bg-[#0b0e11]">
              <td className="px-3 py-4 text-white font-semibold">{position.symbol}</td>

              <td className="px-3 py-4">
                <span className={'font-semibold ' + sideColor}>{position.side.toUpperCase()}</span>
              </td>

              <td className="px-3 py-4 text-right text-white">
                {position.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>

              <td className="px-3 py-4 text-right text-white">
                {position.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="ml-1 text-[#9aa4ad] text-[11px]">USDT</span>
              </td>

              <td className="px-3 py-4 text-right text-white">
                {priceUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="ml-1 text-[#9aa4ad] text-[11px]">USDT</span>
              </td>

              <td className={'px-3 py-4 text-right font-semibold ' + pnlColor}>
                {(pnlUSDT >= 0 ? '+' : '') + pnlUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>

              <td className="px-3 py-4 text-right text-white font-semibold">
                {pnlPercent.toFixed(2)}%
              </td>

              <td className="px-3 py-4 text-right text-white">
                {position.liquidation_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>

              <td className="px-3 py-4 text-right text-[#9aa4ad] text-[11px]">
                <div>TP: {position.take_profit ? position.take_profit.toFixed(2) : '-'}</div>
                <div className="mt-1">SL: {position.stop_loss ? position.stop_loss.toFixed(2) : '-'}</div>
              </td>

              <td className="px-3 py-4 text-right">
                <Button
                  onClick={onClose}
                  className="h-9 rounded-md border border-[#ea3943] bg-transparent px-3 text-[12px] font-semibold text-[#ea3943] hover:bg-[#ea3943]/10"
                >
                  종료
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
