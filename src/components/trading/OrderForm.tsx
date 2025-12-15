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
      {/* 상단: Limit/Market + Leverage pill */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-900/40 p-1">
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
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Leverage</span>
          <div className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-[11px] font-semibold text-slate-100">
            x{leverage}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="h-[calc(100%-44px)] min-h-0 overflow-y-auto pr-1">
        <div className="space-y-3 px-1">
          {/* Buy/Sell */}
          <div className="grid grid-cols-2 gap-2">
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

          {/* Mark */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/35 px-3 py-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <span>MARK</span>
              <button
                type="button"
                onClick={restoreMark}
                className="font-semibold text-slate-400 hover:text-white"
              >
                RESET
              </button>
            </div>
            <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-slate-100">
              {resolvedMarkPrice ? fmt(resolvedMarkPrice, 1) : '--'}{' '}
              <span className="text-slate-500 text-[12px]">USDT</span>
            </div>
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

          {/* Leverage slider */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/35 px-3 py-3">
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

          {/* TP / SL */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-3">
              <label className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>TP</span>
                <input
                  type="checkbox"
                  checked={tpEnabled}
                  onChange={e => setTpEnabled(e.target.checked)}
                  className="accent-emerald-400"
                />
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={!tpEnabled}
                value={takeProfit}
                onChange={e => setTakeProfit(e.target.value)}
                placeholder="Price"
                className={
                  'mt-2 w-full rounded-xl border px-3 py-[10px] text-sm font-semibold focus:outline-none ' +
                  (tpEnabled
                    ? 'border-slate-800 bg-slate-900/60 text-white focus:border-emerald-400'
                    : 'border-slate-900 bg-slate-900/30 text-slate-600')
                }
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-3">
              <label className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>SL</span>
                <input
                  type="checkbox"
                  checked={slEnabled}
                  onChange={e => setSlEnabled(e.target.checked)}
                  className="accent-red-400"
                />
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                disabled={!slEnabled}
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value)}
                placeholder="Price"
                className={
                  'mt-2 w-full rounded-xl border px-3 py-[10px] text-sm font-semibold focus:outline-none ' +
                  (slEnabled
                    ? 'border-slate-800 bg-slate-900/60 text-white focus:border-red-400'
                    : 'border-slate-900 bg-slate-900/30 text-slate-600')
                }
              />
            </div>
          </div>

          {/* summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/35 p-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'ORDER VALUE', value: entryValue },
                { label: 'MARGIN', value: margin },
                { label: 'LIQ', value: liquidation },
                { label: 'FEE', value: feeEstimate },
              ].map(x => (
                <div key={x.label}>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{x.label}</div>
                  <div className="mt-1 font-mono text-[12px] font-semibold tabular-nums text-slate-100">
                    {fmt(x.value, 2)} <span className="text-slate-500">USDT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* submit */}
          <Button
            type="submit"
            className={
              'w-full rounded-2xl py-[12px] text-[14px] font-semibold ' +
              (side === 'long'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
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
