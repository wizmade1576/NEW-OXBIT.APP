import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

type WalletInfo = {
  id: string
  user_id: string
  krw_balance: number
  is_liquidated: boolean
}

const balanceText = (value: number) => `${value.toLocaleString('ko-KR')} 원`

export default function PaperTradingPage() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadWallet = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = getSupabase()
        if (!supabase) throw new Error('Supabase unavailable')
        const { data: sessionData } = await supabase.auth.getUser()
        const userId = sessionData?.user?.id
        if (!userId) {
          setWallet(null)
          setStatusLabel(null)
          return
        }
        const { data: walletData, error: walletError } = await supabase
          .from('paper_wallets')
          .select('id, user_id, krw_balance, is_liquidated')
          .eq('user_id', userId)
          .maybeSingle()
        if (walletError) throw walletError
        setWallet(walletData as WalletInfo | null)
        setStatusLabel(
          walletData
            ? walletData.is_liquidated
              ? '청산됨'
              : '정상'
            : null,
        )
      } catch (err: any) {
        console.error('[PaperTradingPage] loadWallet', err)
        setError('지갑 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadWallet()
  }, [])

  const badge = useMemo(() => {
    if (!wallet) return null
    return wallet.is_liquidated ? (
      <span className="inline-flex rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200">청산됨</span>
    ) : (
      <span className="inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">정상</span>
    )
  }, [wallet])

  return (
    <section className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">모의투자</h2>
          <p className="text-muted-foreground text-sm">실전과 동일한 구조로 전략을 연습하세요</p>
        </div>
        <Button onClick={() => navigate('/paper/trade')}>거래 시작</Button>
      </div>

      <Card className="bg-slate-900/70 border-slate-700">
        <CardHeader>
          <CardTitle>지갑 요약</CardTitle>
          <CardDescription>회원가입 시 자동 생성된 모의투자 지갑입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">현재 잔고</p>
              <p className="text-3xl font-semibold text-white">
                {loading ? '로딩 중...' : wallet ? balanceText(wallet.krw_balance) : '지갑 없음'}
              </p>
            </div>
            <div>{badge}</div>
          </div>
          <p className="text-sm text-slate-400">
            이 지갑은 모의투자 전용 KRW 잔고입니다. 실자산이 아니며, 포지션 손익에 따라 변동됩니다.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => navigate('/paper/wallet')}
              className="rounded-2xl border border-slate-700 bg-transparent text-sm text-white hover:border-white"
            >
              지갑 관리하기
            </Button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
