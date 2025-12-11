export type PositionSide = 'long' | 'short'

export const calcPnL = (
  side: PositionSide,
  entryPrice: number,
  currentPrice: number,
  amount: number,
  leverage: number
) => {
  const diff =
    side === 'long'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice
  return diff * amount * leverage
}

const tieredMaintenanceRates = [
  { max: 50_000, rate: 0.004 },
  { max: 250_000, rate: 0.005 },
  { max: 1_000_000, rate: 0.01 },
  { max: Number.POSITIVE_INFINITY, rate: 0.02 },
]

const calcMMR = (notional: number) => {
  for (const tier of tieredMaintenanceRates) {
    if (notional <= tier.max) {
      return tier.rate
    }
  }
  return 0.02
}

export const calcLiquidation = (
  side: PositionSide,
  entryPrice: number,
  amount: number,
  leverage: number
) => {
  if (leverage <= 0 || amount <= 0 || entryPrice <= 0) return 0

  const notional = entryPrice * amount
  const initialMargin = notional / leverage
  const maintenanceMargin = notional * calcMMR(notional)

  const extra = maintenanceMargin - initialMargin
  if (extra < 0) return 0

  if (side === 'long') {
    const liq = entryPrice + extra / amount
    return liq > 0 ? liq : 0
  }

  const liq = entryPrice - extra / amount
  return liq > 0 ? liq : 0
}

export const calcMaintenance = (margin: number) => margin * 0.005
