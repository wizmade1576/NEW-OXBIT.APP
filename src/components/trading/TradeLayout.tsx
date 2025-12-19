import React, { useEffect, useMemo, useState } from 'react'
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

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpointPx
  })

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpointPx])

  return isMobile
}

function fmtPrice(v: number) {
  if (!Number.isFinite(v)) return '-'
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pctColorClass(pct: number) {
  if (!Number.isFinite(pct)) return 'text-[#9aa4ad]'
  if (pct > 0) return 'text-[#16c784]'
  if (pct < 0) return 'text-red-400'
  return 'text-[#9aa4ad]'
}

/**
 * ✅ 차트 오버레이용 Y 위치 계산
 * - 실제 차트 스케일을 알 수 없으니(TradingView iframe), 현재가 기준으로 “그럴듯한” 위치를 계산해서 표시
 * - rangePct가 클수록 라인 이동이 덜 민감해짐
 */
function calcOverlayTopPercent(entry: number, mark: number, rangePct = 0.08) {
  if (!Number.isFinite(entry) || !Number.isFinite(mark) || mark <= 0) return 50
  const ratio = (entry - mark) / mark // +면 entry가 위, -면 아래
  const clamped = Math.max(-rangePct, Math.min(rangePct, ratio))
  // mark(현재가)=50%, entry가 위면 top 줄어야 함(위로 올라감) => 50 - ...
  const top = 50 - (clamped / rangePct) * 40 // 최대 40% 이동
  return Math.max(6, Math.min(94, top))
}

function EntryLineOverlay({
  position,
  markPrice,
}: {
  position: TradeLayoutProps['position']
  markPrice: number
}) {
  if (!position) return null

  const isLong = position.side === 'long'
  const top = calcOverlayTopPercent(position.entry_price, markPrice, 0.08)
  const color = isLong ? 'bg-[#16c784]' : 'bg-red-400'
  const textColor = isLong ? 'text-[#16c784]' : 'text-red-300'
  const label = `Entry ${fmtPrice(position.entry_price)}`

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20"
      style={{ top: `${top}%` }}
    >
      <div className="flex items-center gap-2 px-2">
        <div className={`h-[1px] flex-1 ${color} opacity-80`} />
        <span className={`text-[11px] ${textColor} bg-black/70 border border-white/10 px-2 py-0.5 rounded`}>
          {label}
        </span>
      </div>
    </div>
  )
}

export default function TradeLayout(props: TradeLayoutProps) {
  const {
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
  } = props

  const isMobile = useIsMobile(768)

  const [entryPrice, setEntryPrice] = useState(priceUSDT)
  const [manualEntry, setManualEntry] = useState(false)

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

  // ✅ MOBILE
  const [topTab, setTopTab] = useState<'chart' | 'orderbook' | 'trades'>('chart')
  const [bottomTab, setBottomTab] = useState<'balances' | 'positions' | 'history'>('positions')

  // ✅ DESKTOP
  const desktopTabs = [
    { id: 'positions', label: 'Open positions' },
    { id: 'history', label: 'Trade history' },
  ] as const
  const [desktopBottomTab, setDesktopBottomTab] = useState<'positions' | 'history'>('positions')

  const walletNode = useMemo(() => {
    if (wallet) {
      return (
        <span>
          KRW <span className="text-white font-semibold">{wallet.krw_balance.toLocaleString()}</span>
          <span className="mx-2 text-[#1f2329]">|</span>
          <span className={wallet.is_liquidated ? 'text-red-400' : 'text-[#16c784]'}>
            {wallet.is_liquidated ? 'Liquidated' : 'OK'}
          </span>
        </span>
      )
    }
    if (walletLoading) return '지갑 정보 로딩중...'
    return '지갑 정보를 준비 중입니다'
  }, [wallet, walletLoading])

  const symbolLabel = useMemo(() => `${symbol.replace('USDT', '')} / USDT`, [symbol])

  if (isMobile) {
    return (
      <div className="h-[100dvh] overflow-hidden bg-[#070c11] text-white flex flex-col">
        {/* TOP BAR */}
        <div className="h-[58px] px-3 flex items-center justify-between border-b border-white/10 bg-[#070c11] flex-none">
          <div className="min-w-0">
            <button
              type="button"
              className="flex items-center gap-2 font-semibold truncate focus:outline-none"
              onClick={() => onChangeSymbol(symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT')}
              title="심볼 변경 (임시 토글)"
            >
              <span className="truncate">{symbolLabel}</span>
              <span className="text-white/60">▾</span>
            </button>
            <div className="mt-0.5 text-[11px] text-white/50 truncate">{walletNode}</div>
          </div>

          <div className="text-right">
            <div className="text-[18px] font-semibold leading-none">{fmtPrice(priceUSDT)}</div>
            <div className={`text-[11px] ${pctColorClass(pnlUSDT)}`}>
              {pnlUSDT >= 0 ? '+' : ''}
              {fmtPrice(pnlUSDT)} / {roePercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* TOP TABS (깔끔 + hover 제거) */}
        <div className="h-[42px] px-2 flex items-center gap-2 border-b border-white/10 bg-[#070c11] flex-none">
          <TopTabBtn active={topTab === 'chart'} onClick={() => setTopTab('chart')}>
            Chart
          </TopTabBtn>
          <TopTabBtn active={topTab === 'orderbook'} onClick={() => setTopTab('orderbook')}>
            Order Book
          </TopTabBtn>
          <TopTabBtn active={topTab === 'trades'} onClick={() => setTopTab('trades')}>
            Trades
          </TopTabBtn>
        </div>

        {/* MAIN VIEW */}
        <div className={topTab === 'chart' ? 'flex-none overflow-hidden' : 'flex-none overflow-visible'}>
          {topTab === 'chart' ? (
            <div className="h-[46vh] max-h-[50vh] overflow-hidden border-b border-white/10">
              {/* ✅ 차트 래퍼를 relative로 만들고 오버레이 라인 얹기 */}
              <div className="relative h-full">
                <TradingChart symbol={symbol} />
                <EntryLineOverlay position={position} markPrice={priceUSDT} />
              </div>
            </div>
          ) : topTab === 'orderbook' ? (
            <div className="px-2 pt-2">
              <div className="border border-white/10 bg-[#05070a] rounded-lg">
                <OrderBook asks={orderBook.asks} bids={orderBook.bids} price={priceUSDT} onSelectPrice={handleSelectPrice} />
              </div>
            </div>
          ) : (
            <div className="px-2 pt-2">
              <div className="border border-white/10 bg-[#05070a] rounded-lg p-2">
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
          )}
        </div>

        {/* BOTTOM PANEL (남는 공간 따라오게) */}
        <div className="flex-1 min-h-0 border-t border-white/10 bg-[#070c11] flex flex-col overflow-hidden">
          <div className="h-[38px] px-2 flex items-center gap-3 border-b border-white/10 overflow-x-auto flex-none">
            <BottomTabBtn active={bottomTab === 'balances'} onClick={() => setBottomTab('balances')}>
              Balances
            </BottomTabBtn>
            <BottomTabBtn active={bottomTab === 'positions'} onClick={() => setBottomTab('positions')}>
              Positions
            </BottomTabBtn>
            <BottomTabBtn active={bottomTab === 'history'} onClick={() => setBottomTab('history')}>
              Trade History
            </BottomTabBtn>
          </div>

          <div className="flex-1 min-h-0 overflow-auto px-2 py-2 pb-[env(safe-area-inset-bottom)]">
            {bottomTab === 'balances' ? (
              <div className="text-[12px] text-white/70">
                <div className="text-[11px] text-white/50 mb-2">Wallet</div>
                <div className="border border-white/10 bg-[#05070a] p-2">{walletNode}</div>
              </div>
            ) : bottomTab === 'positions' ? (
              <div className="space-y-2">
                {position ? (
                  <PositionTable
                    position={position}
                    priceUSDT={priceUSDT}
                    pnlUSDT={pnlUSDT}
                    pnlPercent={roePercent}
                    onClose={onClosePosition}
                  />
                ) : (
                  <div className="text-[12px] text-white/60">표시할 데이터가 없습니다.</div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-white">Trade history</div>
                  <button
                    type="button"
                    onClick={onOpenBetaNotice}
                    className="text-[11px] text-white/60 focus:outline-none"
                  >
                    모의투자 안내
                  </button>
                </div>
                <TradeHistoryTable trades={trades} />
              </div>
            )}
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
                  className="border border-[#1f2329] px-4 py-2 text-[12px] hover:border-white focus:outline-none"
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

  // ✅ DESKTOP
  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-white">
      <div className="h-full p-4">
        <div className="grid h-full grid-rows-[minmax(560px,50vh)_minmax(260px,38vh)] gap-3">
          <div className="min-h-0 grid grid-cols-[1.9fr_0.50fr_0.70fr] gap-0 border border-[#1f2329]">
            <LayoutPanel
              title="Chart"
              right={<span className="uppercase tracking-[0.35em] text-[#9aa4ad]">PERP</span>}
              className="border-0 border-r border-[#1f2329]"
            >
              {/* ✅ 데스크탑도 차트 래퍼 relative + 오버레이 */}
              <div className="relative h-full min-h-0">
                <TradingChart symbol={symbol} />
                <EntryLineOverlay position={position} markPrice={priceUSDT} />
              </div>
            </LayoutPanel>

            <LayoutPanel title="Order book" className="border-0 border-r border-[#1f2329]">
              <div className={`${PANEL_PADDING} h-full min-h-0`}>
                <div className="h-full min-h-0">
                  <OrderBook asks={orderBook.asks} bids={orderBook.bids} price={priceUSDT} onSelectPrice={handleSelectPrice} />
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

          <div className="min-h-0 border border-[#1f2329] bg-black text-[#9aa4ad] flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2329] px-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-4">
                {/* ✅ [FIX 1] BTC/ETH 탭: after 밑줄 제거 → border 밑줄로 변경 */}
                <div className="flex flex-wrap items-center gap-5">
                  {(['BTCUSDT', 'ETHUSDT'] as const).map(s => {
                    const active = symbol === s
                    return (
                      <button
                        key={s}
                        type="button"
                        className={[
                          'text-[13px] font-semibold transition',
                          'py-3',
                          'border-b-2 border-transparent',
                          active ? 'text-white border-white' : 'text-[#9aa4ad] hover:text-white',
                        ].join(' ')}
                        onClick={() => onChangeSymbol(s)}
                      >
                        {s.replace('USDT', '')} / USDT
                      </button>
                    )
                  })}
                </div>

                <span className="hidden h-4 border-l border-[#1f2329] sm:inline-flex" />

                {/* ✅ [FIX 2] Open positions/Trade history 탭도 동일하게 변경 */}
                <div className="flex flex-wrap items-center gap-5">
                  {desktopTabs.map(tab => {
                    const active = desktopBottomTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={[
                          'text-[13px] font-semibold transition',
                          'py-3',
                          'border-b-2 border-transparent',
                          active ? 'text-white border-white' : 'text-[#9aa4ad] hover:text-white',
                        ].join(' ')}
                        onClick={() => setDesktopBottomTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="ml-auto text-[12px] whitespace-nowrap">{walletNode}</div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 pt-4 pb-6 pb-[env(safe-area-inset-bottom)]">
              {desktopBottomTab === 'positions' ? (
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

function TopTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-[13px] font-semibold tracking-tight',
        'focus:outline-none focus:ring-0 active:outline-none',
        active ? 'bg-white/10 text-white' : 'text-white/60',
      ].join(' ')}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  )
}

function BottomTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'whitespace-nowrap px-2 py-1 text-xs font-semibold transition',
        active ? 'text-white border-b-2 border-emerald-400' : 'text-white/60 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
