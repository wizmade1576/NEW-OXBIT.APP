import { FormEvent, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import { calcLiquidation, PositionSide } from '../../utils/margin'

const MAX_AMOUNT = 2

type OrderFormProps = {
  priceUSDT: number
  onOpen: (payload: {
    side: PositionSide
    amount: number
    leverage: number
    takeProfit: number | null
    stopLoss: number | null
  }) => void
}

const tabs = ['market', 'limit', 'tp', 'sl'] as const

export default function OrderForm({ priceUSDT, onOpen }: OrderFormProps) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('market')
  const [side, setSide] = useState<PositionSide>('long')
  const [amount, setAmount] = useState(0.4)
  const [sizePercent, setSizePercent] = useState(25)
  const [leverage, setLeverage] = useState(5)
  const [tpEnabled, setTpEnabled] = useState(true)
  const [slEnabled, setSlEnabled] = useState(true)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [showBetaModal, setShowBetaModal] = useState(false)
  const [betaAcknowledged, setBetaAcknowledged] = useState(false)
  const [pendingOpenPayload, setPendingOpenPayload] = useState<{
    side: PositionSide
    amount: number
    leverage: number
    takeProfit: number | null
    stopLoss: number | null
  } | null>(null)

  const entryValue = useMemo(() => priceUSDT * amount, [priceUSDT, amount])
  const margin = leverage ? entryValue / leverage : 0
  const liquidation = calcLiquidation(side, priceUSDT || 0, amount, leverage || 1)
  const feeEstimate = entryValue * 0.00035

  const handleSlider = (value: number) => {
    const percentage = Math.max(0, Math.min(100, value))
    setSizePercent(percentage)
    setAmount(Number(((percentage / 100) * MAX_AMOUNT).toFixed(4)))
  }

  const handleAmountInput = (raw: string) => {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) {
      setAmount(0)
      setSizePercent(0)
      return
    }
    const percentage = Math.max(0, Math.min(100, (parsed / MAX_AMOUNT) * 100))
    setAmount(parsed)
    setSizePercent(percentage)
  }

  const summary = [
    { label: '진입금액', value: entryValue },
    { label: '필요 증거금', value: margin },
    { label: '예상 청산가', value: liquidation },
    { label: '예상 수수료', value: feeEstimate },
  ]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      side,
      amount,
      leverage,
      takeProfit: tpEnabled && Number(takeProfit) > 0 ? Number(takeProfit) : null,
      stopLoss: slEnabled && Number(stopLoss) > 0 ? Number(stopLoss) : null,
    }

    if (!betaAcknowledged) {
      setPendingOpenPayload(payload)
      setShowBetaModal(true)
      return
    }

    onOpen(payload)
  }

  const handleConfirmBeta = () => {
    setBetaAcknowledged(true)
    setShowBetaModal(false)

    if (pendingOpenPayload) {
      onOpen(pendingOpenPayload)
      setPendingOpenPayload(null)
    }
  }

  const handleCancelBeta = () => {
    setShowBetaModal(false)
    setPendingOpenPayload(null)
  }

  return (
    <section className="flex flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-white shadow-xl shadow-slate-900/30">
      <header className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          oxbit Market
        </p>
        <span className="text-xs text-slate-400">실시간 주문</span>
      </header>

      <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-full border px-3 py-1 transition ${
              activeTab === tab
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                : 'border-slate-800 text-slate-500'
            }`}
          >
            {tab === 'market'
              ? 'Market'
              : tab === 'limit'
              ? 'Limit'
              : tab === 'tp'
              ? 'TP'
              : 'SL'}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-wide">
          <button
            type="button"
            onClick={() => setSide('long')}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
              side === 'long'
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-800 text-slate-400'
            }`}
          >
            LONG
          </button>
          <button
            type="button"
            onClick={() => setSide('short')}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
              side === 'short'
                ? 'border-red-500 bg-red-500/20 text-red-300'
                : 'border-slate-800 text-slate-400'
            }`}
          >
            SHORT
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            수량 (USDT 기준)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(event) => handleAmountInput(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-base font-semibold text-white focus:border-emerald-400 focus:outline-none"
          />
          <div className="flex items-center">
            <input
              type="range"
              min={0}
              max={100}
              value={sizePercent}
              onChange={(event) => handleSlider(Number(event.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-12 text-right text-xs text-slate-400">{sizePercent.toFixed(0)}%</span>
          </div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {[25, 50, 75, 100].map((value) => (
              <button
                type="button"
                key={`percent-${value}`}
                onClick={() => handleSlider(value)}
                className="rounded-full border border-slate-800 px-2 py-1 text-xs font-semibold text-slate-400 transition hover:border-white"
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">레버리지</label>
          <input
            type="range"
            min={1}
            max={20}
            value={leverage}
            onChange={(event) => setLeverage(Number(event.target.value))}
            className="w-full accent-emerald-400"
          />
          <div className="text-sm font-semibold text-white">x{leverage}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-800 px-3 py-2">
            <input
              type="checkbox"
              checked={tpEnabled}
              onChange={(event) => setTpEnabled(event.target.checked)}
              className="accent-emerald-400"
            />
            <span className="text-xs uppercase tracking-wide text-slate-400">TP</span>
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-800 px-3 py-2">
            <input
              type="checkbox"
              checked={slEnabled}
              onChange={(event) => setSlEnabled(event.target.checked)}
              className="accent-red-400"
            />
            <span className="text-xs uppercase tracking-wide text-slate-400">SL</span>
          </label>
        </div>

        {tpEnabled && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Take Profit (USDT)
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-base text-white focus:border-emerald-400 focus:outline-none"
            />
          </div>
        )}

        {slEnabled && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Stop Loss (USDT)
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-base text-white focus:border-red-400 focus:outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
          {summary.map((entry) => (
            <div key={entry.label} className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{entry.label}</p>
              <p className="text-sm font-semibold text-white">{entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-base font-semibold shadow-lg shadow-emerald-500/30"
          >
            {side === 'long' ? 'LONG 진입' : 'SHORT 진입'}
          </Button>
          <Button type="button" className="w-full rounded-2xl border border-slate-800 bg-transparent text-xs text-slate-400">
            시장가 종료 모드
          </Button>
        </div>
      </form>
      {showBetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-100 shadow-xl shadow-black/50">
            <h3 className="text-lg font-semibold text-white">모의투자 베타 테스트 안내</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
              현재 모의투자 betta test version 운영중입니다. 모바일 화면에서는 작동이 불편할 수 있습니다.
              데스크탑을 이용하시기 바랍니다.
            </p>
            <div className="mt-5 flex justify-end gap-3 text-xs uppercase tracking-[0.3em]">
              <button
                type="button"
                onClick={handleCancelBeta}
                className="rounded-full border border-slate-800 px-4 py-2 text-slate-400 transition hover:border-white hover:text-white"
              >
                닫기
              </button>
              <Button
                type="button"
                onClick={handleConfirmBeta}
                className="rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
