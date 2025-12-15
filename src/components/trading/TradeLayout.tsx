import { useEffect, useState } from 'react'
import TradingChart from './TradingChart'
import OrderBook from './OrderBook'
import OrderForm from './OrderForm'
import PositionTable from './PositionTable'
import TradeHistoryTable, { type TradeRecord } from './TradeHistoryTable'

export type WalletSummary = {
  krw_balance: number
  is_liquidated: boolean
}

export type OrderBookEntry = readonly [number, number]

type TradeLayoutProps = {
  symbol: 'BTCUSDT' | 'ETHUSDT'
  onChangeSymbol: (symbol: 'BTCUSDT' | 'ETHUSDT') => void
  priceUSDT: number
  wallet: WalletSummary | null
  walletLoading?: boolean
  orderBook: { asks: OrderBookEntry[]; bids: OrderBookEntry[] }
  position: {
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
  } | null
  pnlUSDT: number
  roePercent: number
  trades: TradeRecord[]
  onClosePosition: () => void
  onOpenOrder: (payload: {
    side: 'long' | 'short'
    amount: number
    leverage: number
    takeProfit: number | null
    stopLoss: number | null
  }) => void
  onOpenBetaNotice: () => void
  showBetaNotice: boolean
  onCloseBetaNotice: () => void
}

const PANEL_PADDING = 'px-3 py-3'

function LayoutPanel({
  title,
  right,
  children,
  className = '',
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-0 overflow-hidden border border-[#1f2329] bg-[#05070a] flex flex-col ${className}`}>
      <div className="h-9 flex items-center justify-between px-3 border-b border-[#1f2329] flex-none">
        <div className="text-[12px] font-semibold text-white">{title}</div>
        {right ? <div className="text-[11px] text-[#9aa4ad]">{right}</div> : null}
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export default function TradeLayout({
  symbol,
  onChangeSymbol,
  priceUSDT,
  wallet,
  walletLoading = false,
  orderBook,
  position,
  pnlUSDT,
  roePercent,
  trades,
  onClosePosition,
  onOpenOrder,
  onOpenBetaNotice,
  showBetaNotice,
  onCloseBetaNotice,
}: TradeLayoutProps) {
  const [entryPrice, setEntryPrice] = useState(priceUSDT)
  const [manualEntry, setManualEntry] = useState(false)
  const [bottomTab, setBottomTab] = useState<'positions' | 'history'>('positions')

  useEffect(() => {
    if (!manualEntry) setEntryPrice(priceUSDT)
  }, [manualEntry, priceUSDT])

  const handleSelectPrice = (price: number) => {
    setManualEntry(true)
    setEntryPrice(price)
  }

  const handleEntryChange = (price: number) => {
    setManualEntry(true)
    setEntryPrice(price)
  }

  const tabs = [
    { id: 'positions', label: 'Open positions' },
    { id: 'history', label: 'Trade history' },
  ] as const

  return (
    // ✅ 핵심: 100vh 대신 100dvh + overflow-hidden (아래 잘림 방지)
    <div className="h-[100dvh] overflow-hidden bg-black text-white">
      {/* 여기 p-4는 원하면 유지/제거 가능 */}
      <div className="h-full p-4">
        {/* ✅ min-h calc 대신: h-full로 고정 */}
        <div className="grid h-full grid-rows-[minmax(560px,50vh)_minmax(260px,38vh)] gap-3">
          {/* 상단 3분할 */}
          <div className="min-h-0 grid grid-cols-[1.9fr_0.50fr_0.70fr] gap-0 border border-[#1f2329]">
            <LayoutPanel
              title="Chart"
              right={<span className="uppercase tracking-[0.35em] text-[#9aa4ad]">PERP</span>}
              className="border-0 border-r border-[#1f2329]"
            >
              <div className="h-full min-h-0">
                <TradingChart symbol={symbol} price={priceUSDT} />
              </div>
            </LayoutPanel>

            <LayoutPanel title="Order book" className="border-0 border-r border-[#1f2329]">
              <div className={`${PANEL_PADDING} h-full min-h-0`}>
                <div className="h-full min-h-0">
                  <OrderBook
                    asks={orderBook.asks}
                    bids={orderBook.bids}
                    price={priceUSDT}
                    onSelectPrice={handleSelectPrice}
                  />
                </div>
              </div>
            </LayoutPanel>

            <LayoutPanel title="Place order" className="border-0">
              <div className={`${PANEL_PADDING} h-full min-h-0`}>
                <div className="h-full min-h-0">
                  <OrderForm
                    priceUSDT={priceUSDT}
                    onOpen={onOpenOrder}
                    entryPrice={entryPrice}
                    manualEntry={manualEntry}
                    markPrice={priceUSDT}
                    onEntryPriceChange={handleEntryChange}
                    onResetEntryPrice={() => setManualEntry(false)}
                  />
                </div>
              </div>
            </LayoutPanel>
          </div>

          {/* 하단 */}
          <div className="min-h-0 border border-[#1f2329] bg-black text-[#9aa4ad] flex flex-col overflow-hidden">
            {/* 탭바 */}
            <div className="flex h-12 flex-none items-center justify-between border-b border-[#1f2329] px-3 text-[13px]">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-5">
                  {(['BTCUSDT', 'ETHUSDT'] as const).map(s => {
                    const active = symbol === s
                    return (
                      <button
                        key={s}
                        type="button"
                        className={
                          'relative pb-2 text-[13px] font-semibold transition ' +
                          (active
                            ? 'text-white after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:bg-white'
                            : 'text-[#9aa4ad] hover:text-white')
                        }
                        onClick={() => onChangeSymbol(s)}
                      >
                        {s.replace('USDT', '')} / USDT
                      </button>
                    )
                  })}
                </div>

                <span className="h-4 border-l border-[#1f2329]" />

                <div className="flex items-center gap-5 pl-5">
                  {tabs.map(tab => {
                    const active = bottomTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          'relative pb-2 text-[13px] font-semibold transition ' +
                          (active
                            ? 'text-white after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:bg-white'
                            : 'text-[#9aa4ad] hover:text-white')
                        }
                        onClick={() => setBottomTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="text-[12px] whitespace-nowrap">
                {wallet ? (
                  <span>
                    KRW <span className="text-white font-semibold">{wallet.krw_balance.toLocaleString()}</span>
                    <span className="mx-2 text-[#1f2329]">|</span>
                    <span className={wallet.is_liquidated ? 'text-red-400' : 'text-[#16c784]'}>
                      {wallet.is_liquidated ? 'Liquidated' : 'OK'}
                    </span>
                  </span>
                ) : (
                  walletLoading ? '지갑 정보 로드중' : '지갑 정보 로드중'
                )}
              </div>
            </div>

            {/* ✅ 핵심: 하단 영역만 스크롤 + 안전 패딩 */}
            <div className="min-h-0 flex-1 overflow-auto p-3 pt-4 pb-6 pb-[env(safe-area-inset-bottom)]">
              {bottomTab === 'positions' ? (
                <div className="space-y-3">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Open positions</div>

                  {position ? (
                    <PositionTable
                      position={position}
                      priceUSDT={priceUSDT}
                      pnlUSDT={pnlUSDT}
                      pnlPercent={roePercent}
                      onClose={onClosePosition}
                    />
                  ) : (
                    <div className="text-[12px] text-[#9aa4ad]">표시할 데이터가 없습니다.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.3em] text-white">
                    <span>Trade history</span>
                    <button
                      type="button"
                      onClick={onOpenBetaNotice}
                      className="text-[11px] text-[#9aa4ad] hover:text-white"
                    >
                      모의투자 안내
                    </button>
                  </div>

                  <TradeHistoryTable trades={trades} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBetaNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="w-full max-w-sm border border-[#1f2329] bg-[#0b0e11] p-6 text-sm text-white">
            <p className="text-sm font-semibold">모의투자 안내</p>
            <p className="mt-3 text-[13px] leading-relaxed text-[#9aa4ad]">
              현재 모의투자 beta test version 운영중입니다. 모바일 화면에서는 작동이 불편할 수 있습니다.
              데스크탑을 이용하시기 바랍니다.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCloseBetaNotice}
                className="border border-[#1f2329] px-4 py-2 text-[12px] hover:border-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
