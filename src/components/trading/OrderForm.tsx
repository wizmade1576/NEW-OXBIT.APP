// src/components/trading/OrderForm.tsx
import { FormEvent, useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { calcLiquidation, PositionSide } from '../../utils/margin'

const orderTabs = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
] as const

type OrderFormProps = {
  priceUSDT: number
  onOpen: (payload: {
    side: PositionSide
    amount: number
    leverage: number
    takeProfit: number | null
    stopLoss: number | null
  }) => void

  entryPrice?: number
  markPrice?: number
  manualEntry?: boolean
  onEntryPriceChange?: (price: number) => void
  onResetEntryPrice?: () => void
}

const MAX_AMOUNT = 2
const fmt = (v: number, digits = 2) =>
  v.toLocaleString(undefined, { maximumFractionDigits: digits })

export default function OrderForm({
  priceUSDT,
  onOpen,
  entryPrice,
  manualEntry,
  onEntryPriceChange,
  onResetEntryPrice,
  markPrice,
}: OrderFormProps) {
  const [orderType, setOrderType] = useState<typeof orderTabs[number]['id']>('limit')
  const [side, setSide] = useState<PositionSide>('long')

  const [amount, setAmount] = useState(0.56)
  const [sizePercent, setSizePercent] = useState(28)
  const [leverage, setLeverage] = useState(9)

  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [showTp, setShowTp] = useState(false)
  const [showSl, setShowSl] = useState(false)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')

  const manualMode = manualEntry ?? false
  const resolvedMarkPrice = markPrice ?? priceUSDT
  const hasControlledEntry = entryPrice !== undefined

  const [internalEntryPrice, setInternalEntryPrice] = useState(resolvedMarkPrice)
  const [entryInput, setEntryInput] = useState(resolvedMarkPrice ? String(resolvedMarkPrice) : '')

  useEffect(() => {
    if (hasControlledEntry) {
      setEntryInput(entryPrice ? String(entryPrice) : '')
      setInternalEntryPrice(entryPrice ?? 0)
    }
  }, [entryPrice, hasControlledEntry])

  useEffect(() => {
    if (!hasControlledEntry && !manualMode) {
      setInternalEntryPrice(resolvedMarkPrice)
      setEntryInput(resolvedMarkPrice ? String(resolvedMarkPrice) : '')
    }
  }, [resolvedMarkPrice, manualMode, hasControlledEntry])

  const resolvedEntryPrice = hasControlledEntry ? (entryPrice as number) : internalEntryPrice

  const entryValue = useMemo(() => resolvedEntryPrice * amount, [resolvedEntryPrice, amount])
  const margin = leverage ? entryValue / leverage : 0
  const liquidation = calcLiquidation(side, priceUSDT || 0, amount, leverage || 1)
  const feeEstimate = entryValue * 0.00035

  const handleSlider = (value: number) => {
    const pct = Math.max(0, Math.min(100, value))
    setSizePercent(pct)
    setAmount(Number(((pct / 100) * MAX_AMOUNT).toFixed(4)))
  }

  const handleAmountInput = (raw: string) => {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    const pct = Math.max(0, Math.min(100, (parsed / MAX_AMOUNT) * 100))
    setAmount(parsed)
    setSizePercent(pct)
  }

  const handleEntryInput = (raw: string) => {
    setEntryInput(raw)
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    setInternalEntryPrice(parsed)
    onEntryPriceChange?.(parsed)
  }

  const restoreMark = () => {
    const v = resolvedMarkPrice
    setEntryInput(v ? String(v) : '')
    setInternalEntryPrice(v)
    onEntryPriceChange?.(v)
    onResetEntryPrice?.()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()

    onOpen({
      side,
      amount,
      leverage,
      takeProfit: tpEnabled && Number(takeProfit) > 0 ? Number(takeProfit) : null,
      stopLoss: slEnabled && Number(stopLoss) > 0 ? Number(stopLoss) : null,
    })

    if (orderType === 'market') {
      setEntryInput(resolvedMarkPrice ? String(resolvedMarkPrice) : '')
      setInternalEntryPrice(resolvedMarkPrice)
      onResetEntryPrice?.()
    }
  }

  return (
    <section className="h-full min-h-0 overflow-hidden">
      <form onSubmit={submit} className="h-full min-h-0 flex flex-col">
        {/* 상단 탭 + 레버리지 pill */}
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-900/30 p-[2px]">
            {orderTabs.map(t => {
              const active = orderType === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOrderType(t.id)}
                  className={
                    'px-3 py-1 rounded-full text-[11px] font-semibold transition ' +
                    (active ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white')
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">LEVERAGE</span>
            <div className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-[11px] font-semibold text-slate-100">
              x{leverage}
            </div>
          </div>
        </div>

        {/* ✅ 본문: 스크롤은 되지만 스크롤바는 숨김 */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
            <div className="space-y-2 px-1">
            {/* ✅ Buy/Sell (롱/숏) */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSide('long')}
                className={
                  'rounded-2xl border px-3 py-[10px] text-[12px] font-semibold transition ' +
                  (side === 'long'
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                    : 'border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white')
                }
              >
                Buy/Long
              </button>
              <button
                type="button"
                onClick={() => setSide('short')}
                className={
                  'rounded-2xl border px-3 py-[10px] text-[12px] font-semibold transition ' +
                  (side === 'short'
                    ? 'border-red-400 bg-red-500/15 text-red-100'
                    : 'border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white')
                }
              >
                Sell/Short
              </button>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>PRICE</span>
                <span className="text-slate-600">{orderType === 'market' ? 'MARKET' : 'LIMIT'}</span>
              </div>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={orderType === 'market'}
                value={orderType === 'market' ? String(resolvedMarkPrice || '') : entryInput}
                onChange={e => handleEntryInput(e.target.value)}
                className={
                  'mt-1 w-full rounded-2xl border px-3 py-[10px] font-mono text-[14px] font-semibold tabular-nums focus:outline-none ' +
                  (orderType === 'market'
                    ? 'border-slate-900 bg-slate-900/40 text-slate-500'
                    : 'border-slate-800 bg-slate-900/60 text-white focus:border-emerald-400')
                }
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>AMOUNT</span>
                <span className="text-slate-600">MAX {MAX_AMOUNT}</span>
              </div>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={e => handleAmountInput(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-[10px] text-[14px] font-semibold text-white focus:border-emerald-400 focus:outline-none"
              />

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sizePercent}
                  onChange={e => handleSlider(Number(e.target.value))}
                  className="flex-1 accent-emerald-400"
                />
                <span className="w-12 text-right text-[11px] text-slate-400">{sizePercent.toFixed(0)}%</span>
              </div>

              <div className="mt-2 flex gap-2">
                {[25, 50, 75, 100].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleSlider(v)}
                    className="flex-1 rounded-full border border-slate-800 bg-slate-900/30 py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* ✅ Leverage slider */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/35 px-2 py-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>LEVERAGE</span>
                <span className="font-mono text-[12px] font-semibold text-slate-100">x{leverage}</span>
              </div>
              <input
                type="range"
                min={1}
                max={200}
                value={leverage}
                onChange={e => setLeverage(Number(e.target.value))}
                className="mt-2 w-full accent-emerald-400"
              />
            </div>

            {/* ✅ TP / SL 토글 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTp(prev => !prev)
                  setTpEnabled(prev => !prev)
                }}
                className={
                  'flex-1 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition ' +
                  (showTp
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : 'border-slate-800 text-slate-300 hover:border-white hover:text-white')
                }
              >
                {showTp ? 'TP on' : 'TP off'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSl(prev => !prev)
                  setSlEnabled(prev => !prev)
                }}
                className={
                  'flex-1 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] transition ' +
                  (showSl
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-slate-800 text-slate-300 hover:border-white hover:text-white')
                }
              >
                {showSl ? 'SL on' : 'SL off'}
              </button>
            </div>

            {showTp && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-2">
                <label className="text-[10px] uppercase tracking-[0.3em] text-slate-500">TP (USDT)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={takeProfit}
                  onChange={e => setTakeProfit(e.target.value)}
                  placeholder="Price"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-[10px] text-sm font-semibold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            )}

            {showSl && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-2">
                <label className="text-[10px] uppercase tracking-[0.3em] text-slate-500">SL (USDT)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)}
                  placeholder="Price"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-[10px] text-sm font-semibold text-white focus:outline-none focus:border-red-400"
                />
              </div>
            )}

            
          </div>
        </div>

        {/* submit */}
        <div className="pt-3">
          <Button
            type="submit"
            className={
              'w-full rounded-2xl py-[12px] text-[14px] font-semibold ' +
              (side === 'long'
                ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25'
                : 'bg-red-500 text-slate-950 shadow-lg shadow-red-500/25')
            }
          >
            {side === 'long' ? 'Buy / Long' : 'Sell / Short'}
          </Button>
        </div>
      </form>
    </section>
  )
}
