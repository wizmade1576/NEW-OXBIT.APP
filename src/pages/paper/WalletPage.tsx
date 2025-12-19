import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

type WalletInfo = {
  id: string
  user_id: string
  krw_balance: number
  is_liquidated: boolean
}

const INITIAL_WALLET_BALANCE = 10_000_000

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const authUser = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false)
      setWallet(null)
      setError(null)
      return
    }

    const loadWallet = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = getSupabase()
        if (!supabase) throw new Error('Supabase client is not available')

        const { data: walletData, error: walletError } = await supabase
          .from('paper_wallets')
          .select('id, user_id, krw_balance, is_liquidated')
          .eq('user_id', authUser.id)
          .maybeSingle()

        if (walletError) throw walletError
        setWallet(walletData as WalletInfo | null)
      } catch (err: any) {
        console.error('[WalletPage] loadWallet', err)
        setError('지갑 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadWallet()
  }, [authUser?.id])

  const statusLabel = useMemo(() => {
    if (!wallet) return null
    return wallet.is_liquidated ? (
      <span className="inline-flex rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">청산됨</span>
    ) : (
      <span className="inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">정상</span>
    )
  }, [wallet])

  const handleCreateOrReset = async () => {
    if (!authUser?.id) {
      setError('로그인이 필요합니다.')
      setCreating(false)
      return
    }

    setCreating(true)
    setError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client is not available')

      if (wallet) {
        const { error } = await supabase
          .from('paper_wallets')
          .update({
            krw_balance: INITIAL_WALLET_BALANCE,
            is_liquidated: false,
          })
          .eq('id', wallet.id)

        if (error) throw error

        setWallet({
          ...wallet,
          krw_balance: INITIAL_WALLET_BALANCE,
          is_liquidated: false,
        })
        alert('지갑이 재생성되어 초기 잔고가 설정되었습니다.')
        return
      }

      const { data: created, error } = await supabase
        .from('paper_wallets')
        .insert({
          user_id: authUser.id,
          krw_balance: INITIAL_WALLET_BALANCE,
          is_liquidated: false,
        })
        .select('id, user_id, krw_balance, is_liquidated')
        .single()

      if (error) throw error

      setWallet(created as WalletInfo)
      alert('기본 증거금 1,000만 원이 있는 지갑이 생성되었습니다.')
    } catch (err: any) {
      console.error('[WalletPage] createOrReset', err)
      setError('지갑 생성/재생성 중 오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  if (!authUser) {
    return (
      <section className="space-y-6 rounded-2xl border border-border bg-[#0b0f15] p-6 text-center text-white">
        <p className="text-lg font-semibold">로그인이 필요합니다.</p>
        <p className="text-sm text-slate-400">모의투자 지갑은 로그인한 회원만 사용할 수 있습니다.</p>
        <Button onClick={() => navigate('/login')} className="mx-auto mt-3">
          로그인하러 가기
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-[#0b0f15] p-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500">모의 투자</p>
        <h1 className="text-3xl font-semibold text-white">내 모의투자 지갑</h1>
      </header>

      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">현재 잔고</p>
            <p className="text-2xl font-semibold text-white sm:text-4xl">
              {wallet ? `${wallet.krw_balance.toLocaleString('ko-KR')} 원` : '지갑 없음'}
            </p>
          </div>
          {statusLabel}
        </div>
        <div className="mt-6 space-y-2 text-sm text-slate-300">
          <p>이 지갑은 모의투자 전용 KRW 잔고입니다.</p>
          <p>실제 자산이 아니며 포지션 손익에 따라 변동됩니다.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={handleCreateOrReset}
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-base font-semibold shadow-lg shadow-emerald-500/30"
            disabled={creating}
          >
            {wallet ? '지갑 재생성' : '지갑 생성'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/paper/trade')}
            disabled={!wallet}
            className="rounded-2xl border-slate-700 px-5 py-2 text-sm text-white hover:border-white hover:text-white"
          >
            거래 시작
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {loading && !wallet && <p className="mt-3 text-xs text-slate-500">지갑 정보를 불러오는 중...</p>}
      </div>
    </section>
  )
}
