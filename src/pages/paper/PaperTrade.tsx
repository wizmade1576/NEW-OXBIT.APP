import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import getSupabase from '../../lib/supabase/client'
import { calcPnL, calcLiquidation, PositionSide } from '../../utils/margin'
import TradeLayout, { WalletSummary, OrderBookEntry } from '../../components/trading/TradeLayout'
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

  const tickerRef = useRef<WebSocket | null>(null)
  const depthRef = useRef<WebSocket | null>(null)

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

  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

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

  const pnlUSDT = useMemo(() => {
    if (!position) return 0
    return calcPnL(position.side, position.entry_price, priceUSDT, position.amount, position.leverage)
  }, [position, priceUSDT])

  const roePercent = useMemo(() => {
    if (!position?.margin) return 0
    return (pnlUSDT / position.margin) * 100
  }, [pnlUSDT, position])

  useEffect(() => {
    if (!position) return
    if (!isPageVisible) return
    if (!isTradeRoute) return

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

      setWallet(prev => (prev ? { ...prev, krw_balance: 0, is_liquidated: true } : prev))
      alert('강제 청산되었습니다. 추가 입금 후 다시 이용 가능합니다.')
      setPosition(null)
    }

    liquidate()
  }, [priceUSDT, position, pnlUSDT, isPageVisible, isTradeRoute])

  useEffect(() => {
    if (!position) return
    if (!priceUSDT) return
    if (!isTradeRoute) return

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
    if (!isPageVisible) return

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
        prev ? { ...prev, krw_balance: prev.krw_balance + position.margin + pnlUSDT } : prev
      )

      alert(isTP ? 'TP 익절이 자동 체결되었습니다.' : 'SL 손절이 자동 체결되었습니다.')
      setPosition(null)
    }

    autoClose()
  }, [priceUSDT, position, pnlUSDT, isPageVisible, isTradeRoute])

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
      prev ? { ...prev, krw_balance: prev.krw_balance + position.margin + pnlUSDT } : prev
    )

    setPosition(null)
  }

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
    if (!wallet) return alert('지갑 정보가 없습니다. 다시 로그인해주세요.')
    if (wallet.is_liquidated) return alert('지갑이 청산 상태입니다. 모의투자 지갑에 입금 후 다시 이용 가능합니다.')

    const margin = (amount * priceUSDT) / leverage
    if (wallet.krw_balance < margin) return alert('잔고가 부족합니다. 모의투자 지갑에 추가 입금이 필요합니다.')

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
    await supabase.from('paper_wallets').update({ krw_balance: newBalance }).eq('id', wallet.id)
  }

  return (
    <TradeLayout
      symbol={symbol}
      onChangeSymbol={setSymbol}
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
  )
}
