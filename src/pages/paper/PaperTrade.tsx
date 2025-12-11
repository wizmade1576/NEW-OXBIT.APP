import { useEffect, useMemo, useRef, useState } from 'react'
import getSupabase from '../../lib/supabase/client'
import { calcPnL, calcLiquidation, PositionSide } from '../../utils/margin'
import TradingChart from '../../components/trading/TradingChart'
import OrderBook from '../../components/trading/OrderBook'
import OrderForm from '../../components/trading/OrderForm'
import PositionTable from '../../components/trading/PositionTable'
import TradeHistoryTable, { type TradeRecord } from '../../components/trading/TradeHistoryTable'

type WalletRecord = {
  id: string
  user_id: string
  krw_balance: number
  usdt_balance?: number
  is_liquidated: boolean
}

export type PositionRecord = {
  id: string
  user_id: string
  symbol: 'BTCUSDT' | 'ETHUSDT'
  side: PositionSide
  entry_price: number
  leverage: number
  amount: number
  margin: number
  liquidation_price: number
  take_profit: number | null
  stop_loss: number | null
}

type OrderBookEntry = [number, number]

const supabase = getSupabase()

export default function PaperTrade() {
  const [wallet, setWallet] = useState<WalletRecord | null>(null)
  const [position, setPosition] = useState<PositionRecord | null>(null)
  const [symbol, setSymbol] = useState<'BTCUSDT' | 'ETHUSDT'>('BTCUSDT')
  const [priceUSDT, setPriceUSDT] = useState(0)
  const [orderBook, setOrderBook] = useState<{ asks: OrderBookEntry[]; bids: OrderBookEntry[] }>({
    asks: [],
    bids: [],
  })
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [showHistory, setShowHistory] = useState(true)
  const [showMobileOrderBook, setShowMobileOrderBook] = useState(false)
  const [showMobilePosition, setShowMobilePosition] = useState(true)
  const [showBetaNotice, setShowBetaNotice] = useState(false)

  const tickerRef = useRef<WebSocket | null>(null)
  const depthRef = useRef<WebSocket | null>(null)

  // ✅ 실시간 Binance 선물 WS
  useEffect(() => {
    const lower = symbol.toLowerCase()
    const tickerWS = new WebSocket(`wss://fstream.binance.com/ws/${lower}@ticker`)
    const depthWS = new WebSocket(`wss://fstream.binance.com/ws/${lower}@depth10@100ms`)

    tickerRef.current?.close()
    depthRef.current?.close()

    tickerRef.current = tickerWS
    depthRef.current = depthWS

    tickerWS.onmessage = evt => {
      const data = JSON.parse(evt.data)
      const p = Number(data?.c)
      if (!Number.isNaN(p)) setPriceUSDT(p)
    }

    depthWS.onmessage = evt => {
      const data = JSON.parse(evt.data)
      const asks = (data?.a ?? []).slice(0, 10).map((e: any) => [Number(e[0]), Number(e[1])])
      const bids = (data?.b ?? []).slice(0, 10).map((e: any) => [Number(e[0]), Number(e[1])])
      setOrderBook({ asks, bids })
    }

    return () => {
      tickerWS.close()
      depthWS.close()
    }
  }, [symbol])

  // ✅ 지갑 + 포지션 로드
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) return

      const { data: pos } = await supabase
        .from('paper_positions')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (pos) setPosition(pos as PositionRecord)

      const { data: wal } = await supabase
        .from('paper_wallets')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (wal) setWallet(wal as WalletRecord)
    }

    load()
  }, [])

  // ✅ 체결 내역 로드
  useEffect(() => {
    const loadTrades = async () => {
      const { data } = await supabase.auth.getUser()
      const userId = data?.user?.id
      if (!userId) return

      const { data: rows } = await supabase
        .from('paper_trades')
        .select('id, user_id, type, symbol, price, amount, leverage, pnl, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (rows) setTrades(rows as TradeRecord[])
    }

    loadTrades()
  }, [])

  // ✅ PNL 계산
  const pnlUSDT = useMemo(() => {
    if (!position) return 0
    return calcPnL(position.side, position.entry_price, priceUSDT, position.amount, position.leverage)
  }, [position, priceUSDT])

  const roePercent = useMemo(() => {
    if (!position?.margin) return 0
    return (pnlUSDT / position.margin) * 100
  }, [pnlUSDT, position])

  // ✅ 강제청산 트리거
  useEffect(() => {
    if (!position) return

    const liq =
      (position.side === 'long' && priceUSDT <= position.liquidation_price) ||
      (position.side === 'short' && priceUSDT >= position.liquidation_price)

    if (!liq) return

    const liquidate = async () => {
      await supabase.from('paper_trades').insert({
        user_id: position.user_id,
        type: 'liq',
        symbol: position.symbol,
        price: priceUSDT,
        amount: position.amount,
        leverage: position.leverage,
        pnl: pnlUSDT,
      })

      await supabase.from('paper_positions').delete().eq('id', position.id)

      await supabase
        .from('paper_wallets')
        .update({ krw_balance: 0, is_liquidated: true })
        .eq('user_id', position.user_id)

      setWallet(prev =>
        prev
          ? {
              ...prev,
              krw_balance: 0,
              is_liquidated: true,
            }
          : prev
      )

      alert('강제 청산되었습니다. 추가 입금 후 다시 이용 가능합니다.')
      setPosition(null)
    }

    liquidate()
  }, [priceUSDT, position, pnlUSDT])

  // ✅ TP / SL 자동 체결
  useEffect(() => {
    if (!position) return
    if (!priceUSDT) return

    const hasTP = position.take_profit != null
    const hasSL = position.stop_loss != null

    const isTP =
      hasTP &&
      ((position.side === 'long' && priceUSDT >= (position.take_profit as number)) ||
        (position.side === 'short' && priceUSDT <= (position.take_profit as number)))

    const isSL =
      hasSL &&
      ((position.side === 'long' && priceUSDT <= (position.stop_loss as number)) ||
        (position.side === 'short' && priceUSDT >= (position.stop_loss as number)))

    if (!isTP && !isSL) return

    const autoClose = async () => {
      const type = isTP ? 'tp' : 'sl'

      await supabase.from('paper_trades').insert({
        user_id: position.user_id,
        type,
        symbol: position.symbol,
        price: priceUSDT,
        amount: position.amount,
        leverage: position.leverage,
        pnl: calcPnL(position.side, position.entry_price, priceUSDT, position.amount, position.leverage),
      })

      await supabase.from('paper_positions').delete().eq('id', position.id)

      setWallet(prev =>
        prev
          ? {
              ...prev,
              krw_balance: prev.krw_balance + position.margin + pnlUSDT,
            }
          : prev
      )

      alert(isTP ? 'TP 익절이 자동 체결되었습니다.' : 'SL 손절이 자동 체결되었습니다.')
      setPosition(null)
    }

    autoClose()
  }, [priceUSDT, position, pnlUSDT])

  // ✅ 포지션 수동 청산
  const handleClosePosition = async () => {
    if (!position) return

    await supabase.from('paper_trades').insert({
      user_id: position.user_id,
      type: 'close',
      symbol: position.symbol,
      price: priceUSDT,
      amount: position.amount,
      leverage: position.leverage,
      pnl: pnlUSDT,
    })

    await supabase.from('paper_positions').delete().eq('id', position.id)

    setWallet(prev =>
      prev
        ? {
            ...prev,
            krw_balance: prev.krw_balance + position.margin + pnlUSDT,
          }
        : prev
    )

    setPosition(null)
  }

  // ✅ 주문 오픈
  const handleOpen = async ({
    side,
    amount,
    leverage,
    takeProfit,
    stopLoss,
  }: {
    side: PositionSide
    amount: number
    leverage: number
    takeProfit: number | null
    stopLoss: number | null
  }) => {
    if (!wallet) {
      alert('지갑 정보가 없습니다. 다시 로그인해주세요.')
      return
    }

    if (wallet.is_liquidated) {
      alert('지갑이 청산 상태입니다. 모의투자 지갑에 입금 후 다시 이용 가능합니다.')
      return
    }

    const margin = (amount * priceUSDT) / leverage

    if (wallet.krw_balance < margin) {
      alert('잔고가 부족합니다. 모의투자 지갑에 추가 입금이 필요합니다.')
      return
    }

    const liquidation = calcLiquidation(side, priceUSDT, amount, leverage)

    const { data } = await supabase.auth.getUser()
    if (!data?.user) return

    const { data: inserted, error } = await supabase
      .from('paper_positions')
      .insert({
        user_id: data.user.id,
        symbol,
        side,
        entry_price: priceUSDT,
        leverage,
        amount,
        margin,
        liquidation_price: liquidation,
        take_profit: takeProfit,
        stop_loss: stopLoss,
      })
      .select()
      .single()

    if (error) {
      console.error('paper_positions insert failed', error)
      alert(`포지션 생성 중 오류: ${error.message || '알 수 없는 이유'}`)
      return
    }

    setPosition(inserted as PositionRecord)

    const newBalance = wallet.krw_balance - margin
    setWallet({ ...wallet, krw_balance: newBalance })

    await supabase
      .from('paper_wallets')
      .update({ krw_balance: newBalance })
      .eq('id', wallet.id)
  }

  // ✅ 렌더링
  return (
    <div className="space-y-4 px-4 pb-6">
      {/* 상단 헤더: 심볼 탭 + 현재가 / 지갑 정보 */}
      <div className="mt-2 flex items-end justify-between px-1">
        {/* 왼쪽: 심볼 탭 + 현재가 */}
        <div className="flex items-end gap-5">
          <div className="inline-flex rounded-full bg-slate-900 p-1 border border-slate-700">
            {(['BTCUSDT', 'ETHUSDT'] as const).map(s => {
              const active = symbol === s
              return (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={
                    'px-3 py-1 rounded-full text-[11px] transition ' +
                    (active
                      ? 'bg-emerald-500 text-slate-900 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800')
                  }
                >
                  {s.replace('USDT', '')} / USDT
                </button>
              )
            })}
          </div>

        <div className="pb-1">
          <div className="text-[11px] text-slate-500">
            Binance Perpetual · {symbol}
          </div>
          <div className="text-base font-semibold text-slate-100">
            {priceUSDT ? priceUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'} USDT
          </div>
          <button
            type="button"
            onClick={() => setShowBetaNotice(true)}
            className="mt-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-400 hover:text-white"
          >
            모의투자 안내
          </button>
        </div>
        </div>

        {/* 오른쪽: 지갑 박스 */}
        {wallet ? (
          <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100">
            <div className="grid grid-cols-[2fr_1fr] gap-x-4 gap-y-1 items-start text-[11px] leading-tight">
              <div>
                <div className="text-slate-400">모의 투자 지갑 잔고</div>
                <div className="text-sm font-semibold text-slate-100">
                  KRW {wallet.krw_balance.toLocaleString()} 원
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-400">지갑 상태</div>
                <div
                  className={
                    (wallet.is_liquidated ? 'text-red-400' : 'text-emerald-400') +
                    ' font-semibold text-sm'
                  }
                >
                  {wallet.is_liquidated ? '청산됨' : '정상'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">지갑 정보를 불러오는 중...</div>
        )}
      </div>

      {/* 메인 레이아웃: 반응형 1~3 컬럼 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-[2fr_1.5fr] lg:grid-cols-[3fr_2fr_1.2fr]">
        <div className="px-2 md:px-0">
          <TradingChart symbol={symbol} price={priceUSDT} />
        </div>
        <div className="px-2 md:px-0">
          <OrderForm priceUSDT={priceUSDT} onOpen={handleOpen} />
        </div>
        <div className="hidden lg:block">
          <OrderBook asks={orderBook.asks} bids={orderBook.bids} price={priceUSDT} loading={false} />
        </div>
      </div>

      {/* 모바일에서 OrderBook 토글 */}
      <div className="lg:hidden space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Order Book</span>
          <button
            type="button"
            onClick={() => setShowMobileOrderBook((prev) => !prev)}
            className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 hover:text-white transition"
          >
            {showMobileOrderBook ? '닫기' : '열기'}
          </button>
        </div>
        {showMobileOrderBook && (
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-2">
            <OrderBook asks={orderBook.asks} bids={orderBook.bids} price={priceUSDT} loading={false} />
          </div>
        )}
      </div>
      {/* 실시간 손익 요약 */}

      {position && (
        <div className="flex items-center justify-between text-xs px-1">
          <div className="text-slate-400">실시간 손익 (USDT)</div>
          <div className={pnlUSDT >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {pnlUSDT.toFixed(3)} USDT ({roePercent.toFixed(2)}%)
          </div>
        </div>
      )}

      {/* 데스크탑 포지션 테이블 */}
      <div className="hidden lg:block">
        <PositionTable
          position={position}
          priceUSDT={priceUSDT}
          pnlUSDT={pnlUSDT}
          pnlPercent={roePercent}
          onClose={handleClosePosition}
        />
      </div>

      {/* 모바일 포지션 아코디언 */}
      <div className="lg:hidden space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>현재 포지션</span>
          <button
            type="button"
            onClick={() => setShowMobilePosition(prev => !prev)}
            className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 hover:text-white transition"
          >
            {showMobilePosition ? '닫기' : '열기'}
          </button>
        </div>
        {showMobilePosition && (
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3">
            <PositionTable
              position={position}
              priceUSDT={priceUSDT}
              pnlUSDT={pnlUSDT}
              pnlPercent={roePercent}
              onClose={handleClosePosition}
            />
          </div>
        )}
      </div>

      {/* Trade History (데스크탑) */}
      <div className="hidden lg:block space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>체결 내역</span>
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 hover:text-white transition"
          >
            {showHistory ? '닫기' : '열기'}
          </button>
        </div>
        {showHistory && (
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3">
            <TradeHistoryTable trades={trades} />
          </div>
        )}
      </div>

      {/* Trade History (모바일) */}
      <div className="lg:hidden space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>체결 내역</span>
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 hover:text-white transition"
          >
            {showHistory ? '닫기' : '열기'}
          </button>
        </div>
        {showHistory && (
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3">
            <TradeHistoryTable trades={trades} />
          </div>
        )}
      </div>
      {showBetaNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-100 shadow-2xl shadow-black/60">
            <p className="text-sm font-semibold text-white">모의투자 안내</p>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              현재 모의투자 betta test version 운영중입니다. 모바일 화면에서는 작동이 불편할 수 있습니다.
              데스크탑을 이용하시기 바랍니다.
            </p>
            <div className="mt-5 flex justify-end gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              <button
                type="button"
                onClick={() => setShowBetaNotice(false)}
                className="rounded-full border border-slate-800 px-4 py-2 transition hover:border-white hover:text-white"
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
