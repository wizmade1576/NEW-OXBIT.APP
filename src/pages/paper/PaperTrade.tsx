import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import getSupabase from '../../lib/supabase/client'
import { calcPnL, calcLiquidation, PositionSide } from '../../utils/margin'
import TradeLayout, { WalletSummary, OrderBookEntry } from '../../components/trading/TradeLayout'
import Button from '../../components/ui/Button'
import type { TradeRecord } from '../../components/trading/TradeHistoryTable'

type WalletRecord = WalletSummary

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

const supabase = getSupabase()

export default function PaperTrade() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const navigate = useNavigate()

  const [wallet, setWallet] = useState<WalletRecord | null>(null)
  const [position, setPosition] = useState<PositionRecord | null>(null)
  const [symbol, setSymbol] = useState<'BTCUSDT' | 'ETHUSDT'>('BTCUSDT')
  const [priceUSDT, setPriceUSDT] = useState(0)

  const [orderBook, setOrderBook] = useState<{ asks: OrderBookEntry[]; bids: OrderBookEntry[] }>({
    asks: [],
    bids: [],
  })

  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [showBetaNotice, setShowBetaNotice] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const location = useLocation()

  const isTradeRoute = location.pathname === '/paper/trade'
  const showLoginModal = authChecked && !userId

  const tickerRef = useRef<WebSocket | null>(null)
  const depthRef = useRef<WebSocket | null>(null)

  // ✅ auth uid 1회 로드
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        setUserId(data?.user?.id ?? null)
      } finally {
        setAuthChecked(true)
      }
    }
    loadAuth()
  }, [])

  // ✅ 심볼(차트/호가) 변경: 포지션 열려있으면 변경 막아서 PnL 꼬임 방지
  const handleChangeSymbol = (next: 'BTCUSDT' | 'ETHUSDT') => {
    if (position && position.symbol !== next) {
      alert(`이미 ${position.symbol} 포지션이 열려 있습니다.\n포지션 종료 후 다른 심볼로 이동하세요.`)
      return
    }
    setSymbol(next)
  }

  // ✅ 바이낸스 WS (symbol 기준)
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

  // --- helpers ---
  const refreshWallet = async (uid: string) => {
    const { data: wal } = await supabase.from('paper_wallets').select('*').eq('user_id', uid).maybeSingle()
    if (wal) setWallet(wal as WalletRecord)
  }

  const refreshPositionForSymbol = async (uid: string, sym: 'BTCUSDT' | 'ETHUSDT') => {
    const { data: pos } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', uid) // ✅ 절대 현재 uid만
      .eq('symbol', sym)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setPosition((pos as PositionRecord) ?? null)
  }

  const refreshLatestPosition = async (uid: string) => {
    const { data: pos } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pos) {
      setPosition(pos as PositionRecord)
      setSymbol((pos as PositionRecord).symbol)
    } else {
      setPosition(null)
    }
  }

  const refreshTrades = async (uid: string) => {
    const { data: rows } = await supabase
      .from('paper_trades')
      .select('id, user_id, type, symbol, price, amount, leverage, pnl, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(30)

    if (rows) setTrades(rows as TradeRecord[])
  }

  // ✅ 초기 로드(지갑/포지션/트레이드)
  useEffect(() => {
    if (!userId) return
    refreshWallet(userId)
    refreshLatestPosition(userId)
    refreshTrades(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ✅ 심볼 바뀌면(포지션 없을 때만) 포지션 재조회
  useEffect(() => {
    if (!userId) return
    if (position) return
    refreshPositionForSymbol(userId, symbol)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, userId])

  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const pnlUSDT = useMemo(() => {
    if (!position) return 0
    return calcPnL(position.side, position.entry_price, priceUSDT, position.amount, position.leverage)
  }, [position, priceUSDT])

  const roePercent = useMemo(() => {
    if (!position?.margin) return 0
    return (pnlUSDT / position.margin) * 100
  }, [pnlUSDT, position])

  // ✅ 강제 청산
  useEffect(() => {
    if (!userId) return
    if (!position || !priceUSDT || !isPageVisible || !isTradeRoute) return

    const liq =
      (position.side === 'long' && priceUSDT <= position.liquidation_price) ||
      (position.side === 'short' && priceUSDT >= position.liquidation_price)

    if (!liq) return

    const liquidate = async () => {
      await supabase.from('paper_trades').insert({
        user_id: userId,
        type: 'liq',
        symbol: position.symbol,
        price: priceUSDT,
        amount: position.amount,
        leverage: position.leverage,
        pnl: pnlUSDT,
      })

      await supabase.from('paper_positions').delete().eq('id', position.id).eq('user_id', userId)

      await supabase.from('paper_wallets').update({ krw_balance: 0, is_liquidated: true }).eq('user_id', userId)

      setWallet(prev => (prev ? { ...prev, krw_balance: 0, is_liquidated: true } : prev))
      alert('강제 청산되었습니다. 추가 입금 후 다시 이용 가능합니다.')
      setPosition(null)
      await refreshTrades(userId)
    }

    liquidate()
  }, [priceUSDT, position, pnlUSDT, isPageVisible, isTradeRoute, userId])

  // ✅ TP/SL 자동 종료
  useEffect(() => {
    if (!userId) return
    if (!position || !priceUSDT || !isTradeRoute || !isPageVisible) return

    const hasTP = position.take_profit != null
    const hasSL = position.stop_loss != null

    const isTP =
      hasTP &&
      ((position.side === 'long' && priceUSDT >= position.take_profit!) ||
        (position.side === 'short' && priceUSDT <= position.take_profit!))

    const isSL =
      hasSL &&
      ((position.side === 'long' && priceUSDT <= position.stop_loss!) ||
        (position.side === 'short' && priceUSDT >= position.stop_loss!))

    if (!isTP && !isSL) return

    const autoClose = async () => {
      await supabase.from('paper_trades').insert({
        user_id: userId,
        type: isTP ? 'tp' : 'sl',
        symbol: position.symbol,
        price: priceUSDT,
        amount: position.amount,
        leverage: position.leverage,
        pnl: pnlUSDT,
      })

      await supabase.from('paper_positions').delete().eq('id', position.id).eq('user_id', userId)

      setWallet(prev => (prev ? { ...prev, krw_balance: prev.krw_balance + position.margin + pnlUSDT } : prev))
      alert(isTP ? 'TP 익절이 자동 체결되었습니다.' : 'SL 손절이 자동 체결되었습니다.')
      setPosition(null)
      await refreshTrades(userId)
      await refreshWallet(userId)
    }

    autoClose()
  }, [priceUSDT, position, pnlUSDT, isPageVisible, isTradeRoute, userId])

  // ✅ 종료: UI 즉시 비우고 → DB 처리 → 최종 DB 재조회로 정렬
  const handleClosePosition = async () => {
    if (!userId) return alert('로그인 정보가 없습니다. 다시 로그인해주세요.')
    if (!position) return

    const closing = position
    const credit = closing.margin + pnlUSDT

    // UI 즉시 제거
    setPosition(null)

    // 1) trade insert
    const { error: tradeErr } = await supabase.from('paper_trades').insert({
      user_id: userId,
      type: 'close',
      symbol: closing.symbol,
      price: priceUSDT,
      amount: closing.amount,
      leverage: closing.leverage,
      pnl: pnlUSDT,
    })

    if (tradeErr) {
      setPosition(closing)
      alert(`종료 기록 저장 실패: ${tradeErr.message}`)
      return
    }

    // 2) delete (auth uid 기준 강제)
    const { data: deleted, error: delErr } = await supabase
      .from('paper_positions')
      .delete()
      .eq('id', closing.id)
      .eq('user_id', userId)
      .select('id')

    if (delErr) {
      setPosition(closing)
      alert(`포지션 삭제 실패: ${delErr.message}`)
      return
    }

    if (!deleted || deleted.length === 0) {
      // ✅ 여기서 closing을 복구하지 말고, DB 재조회로 화면을 “정답”으로 맞춤
      await refreshPositionForSymbol(userId, symbol)
      alert('포지션 삭제가 0건 처리되었습니다. (DB에 다른 user_id로 저장된 포지션일 수 있음)')
      return
    }

    // 3) wallet UI + DB
    setWallet(prev => (prev ? { ...prev, krw_balance: prev.krw_balance + credit } : prev))

    if (wallet?.id) {
      const nextBalance = (wallet?.krw_balance ?? 0) + credit
      await supabase.from('paper_wallets').update({ krw_balance: nextBalance }).eq('id', wallet.id)
    }

    await refreshTrades(userId)
    await refreshWallet(userId)
  }

  // ✅ 포지션 오픈 (심볼당 1개 제한)
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
    if (!userId) return

    // 이미 포지션이 있으면(현재 구조는 사실상 1개만) 차단
    if (position) {
      return alert(`이미 ${position.symbol} 포지션이 열려 있습니다.\n해당 포지션을 종료한 후 거래하세요.`)
    }

    const { data: existing } = await supabase
      .from('paper_positions')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .limit(1)

    if (existing && existing.length > 0) {
      return alert('해당 심볼에 이미 열린 포지션이 있습니다.')
    }

    if (!wallet) return alert('지갑 정보가 없습니다. 다시 로그인해주세요.')
    if (wallet.is_liquidated) return alert('지갑이 청산 상태입니다. 모의투자 지갑에 입금 후 다시 이용 가능합니다.')

    const margin = (amount * priceUSDT) / leverage
    if (wallet.krw_balance < margin) return alert('잔고가 부족합니다. 모의투자 지갑에 추가 입금이 필요합니다.')

    const liquidation = calcLiquidation(side, priceUSDT, amount, leverage)

    const { data: inserted, error } = await supabase
      .from('paper_positions')
      .insert({
        user_id: userId,
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
      alert(`포지션 생성 중 오류: ${error.message}`)
      return
    }

    setPosition(inserted as PositionRecord)

    const newBalance = wallet.krw_balance - margin
    setWallet({ ...wallet, krw_balance: newBalance })
    await supabase.from('paper_wallets').update({ krw_balance: newBalance }).eq('id', wallet.id)

    await refreshTrades(userId)
  }

  return (
    <>
      <TradeLayout
        symbol={symbol}
        onChangeSymbol={handleChangeSymbol}
        priceUSDT={priceUSDT}
        wallet={wallet}
        walletLoading={!wallet}
        orderBook={orderBook}
        position={position}
        pnlUSDT={pnlUSDT}
        roePercent={roePercent}
        trades={trades}
        onClosePosition={handleClosePosition}
        onOpenOrder={handleOpen}
        onOpenBetaNotice={() => setShowBetaNotice(true)}
        showBetaNotice={showBetaNotice}
        onCloseBetaNotice={() => setShowBetaNotice(false)}
      />

      {showLoginModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-[#0b0f15] p-6 text-center text-white">
            <p className="text-sm text-white">모의투자 페이지는 로그인 이용 후 가능합니다.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => navigate('/login')} className="px-5 py-2 text-sm">
                로그인
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="px-5 py-2 text-sm">
                홈으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
