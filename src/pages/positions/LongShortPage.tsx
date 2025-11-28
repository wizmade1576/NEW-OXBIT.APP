import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'

type LongShortItem = {
  id: string
  symbol: string
  name: string
  longPct: number
  shortPct: number
  longNotional: string
  shortNotional: string
  totalNotional: string
}

// 정적 샘플 데이터 (외부/Supabase 사용 안 함)
const MOCK_DATA: LongShortItem[] = [
  { id: 'btc', symbol: 'BTC', name: 'BTC', longPct: 77.4, shortPct: 22.6, longNotional: '4,439억 원', shortNotional: '1,296억 원', totalNotional: '5,734억 원' },
  { id: 'eth', symbol: 'ETH', name: 'ETH', longPct: 70.29, shortPct: 29.71, longNotional: '2,917억 원', shortNotional: '1,233억 원', totalNotional: '4,151억 원' },
  { id: 'doge', symbol: 'DOGE', name: 'DOGE', longPct: 10.84, shortPct: 89.16, longNotional: '150억 원', shortNotional: '1,234억 원', totalNotional: '1,384억 원' },
  { id: 'xrp', symbol: 'XRP', name: 'XRP', longPct: 16.89, shortPct: 83.11, longNotional: '199억 원', shortNotional: '979억 원', totalNotional: '1,178억 원' },
  { id: 'sol', symbol: 'SOL', name: 'SOL', longPct: 33.97, shortPct: 66.03, longNotional: '338억 원', shortNotional: '657억 원', totalNotional: '994억 원' },
  { id: 'zec', symbol: 'ZEC', name: 'ZEC', longPct: 32.87, shortPct: 67.13, longNotional: '267억 원', shortNotional: '545억 원', totalNotional: '812억 원' },
  { id: 'avax', symbol: 'AVAX', name: 'AVAX', longPct: 58.66, shortPct: 41.34, longNotional: '326억 원', shortNotional: '230억 원', totalNotional: '556억 원' },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', longPct: 63.78, shortPct: 36.22, longNotional: '329억 원', shortNotional: '187억 원', totalNotional: '515억 원' },
  { id: 'pepe', symbol: '1000PEPE', name: '1000PEPE', longPct: 26.53, shortPct: 73.47, longNotional: '61억 원', shortNotional: '169억 원', totalNotional: '230억 원' },
  { id: 'usj', symbol: 'USUAL', name: 'USUAL', longPct: 6.41, shortPct: 93.59, longNotional: '6.7천만 원', shortNotional: '10억 원', totalNotional: '10억 원' },
]

function Bar({ item }: { item: LongShortItem }) {
  const longWidth = `${Math.max(0, Math.min(100, item.longPct))}%`
  const shortWidth = `${Math.max(0, Math.min(100, item.shortPct))}%`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px] text-neutral-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{item.name}</span>
          <span className="text-xs text-neutral-500">{item.totalNotional}</span>
        </div>
        <div className="text-xs text-neutral-500 hidden sm:block">롱 & 숏 포지션 비율</div>
      </div>
      <div className="relative w-full overflow-hidden rounded-full bg-[#161616] border border-[#222]">
        <div className="flex h-10 w-full">
          <div
            className="flex items-center justify-start pl-3 text-[12px] font-semibold text-white bg-[#0ea5e9]/90"
            style={{ width: longWidth }}
            title={`Long ${item.longPct.toFixed(2)}%`}
          >
            {item.longPct > 6 ? (
              <div className="flex flex-col leading-4">
                <span>{item.longPct.toFixed(2)}%</span>
                <span className="text-[11px] text-[#dff6ff]">{item.longNotional}</span>
              </div>
            ) : null}
          </div>
          <div
            className="flex items-center justify-end pr-3 text-[12px] font-semibold text-white bg-[#ef4444]/85 ml-auto"
            style={{ width: shortWidth }}
            title={`Short ${item.shortPct.toFixed(2)}%`}
          >
            {item.shortPct > 6 ? (
              <div className="flex flex-col leading-4 items-end">
                <span>{item.shortPct.toFixed(2)}%</span>
                <span className="text-[11px] text-[#ffe4e6]">{item.shortNotional}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LongShortPage() {
  const [data] = React.useState<LongShortItem[]>(MOCK_DATA)

  return (
    <section className="space-y-4">
      <Card className="bg-[#0f1115] border-neutral-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-white">롱 vs 숏 포지션 비율</CardTitle>
            <span className="rounded-full bg-[#1e2633] px-3 py-1 text-xs text-neutral-300">공개 페이지</span>
          </div>
          <CardDescription className="text-sm text-neutral-300">
            정적 샘플 데이터로 롱/숏 비율과 청산 구간을 가볍게 확인합니다. (데이터 소스: 외부/실시간 연결 없음)
          </CardDescription>
          <div className="mt-2 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-[#0ea5e9]/90" /> 롱
            </span>
            <span className="inline-flex items-center gap-2 ml-3">
              <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444]/85" /> 숏
            </span>
            <span className="inline-block ml-3 text-[11px] text-[#fbbf24]">
              * 실제 연동 시 여기 라벨을 청산 레벨 정보로 교체할 수 있습니다.
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.map((item) => (
            <Bar key={item.id} item={item} />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
