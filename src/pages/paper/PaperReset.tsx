import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import getSupabase from '../../lib/supabase/client'

type WalletRecord = {
  id: string
  user_id: string
  krw_balance: number
  is_liquidated: boolean
}

export default function PaperReset() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState<WalletRecord | null>(null)
  const [processing, setProcessing] = useState(false)
  const supabase = getSupabase()

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) {
        alert('로그인이 필요합니다.')
        navigate('/login')
        return
      }

      const { data: existing } = await supabase
        .from('paper_wallets')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (!existing || !existing.is_liquidated) {
        alert('현재 청산 상태가 아닙니다.')
        navigate('/paper')
        return
      }

      setWallet(existing as WalletRecord)
    }

    load()
  }, [navigate])

  const handleReset = async () => {
    if (!wallet || processing) return
    setProcessing(true)
    try {
      await supabase
        .from('paper_wallets')
        .update({
          krw_balance: 10000000,
          is_liquidated: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)

      await supabase.from('paper_reset_orders').insert({
        user_id: wallet.user_id,
        amount: 100000,
        reset_amount: 10000000,
        status: 'paid',
      })

      await supabase.from('paper_rewards').insert({
        user_id: wallet.user_id,
        amount: 10000000,
        reason: '결제리셋(가상)',
      })

      alert('청산 복구가 완료되었습니다.')
      navigate('/paper')
    } catch (err) {
      console.error(err)
      alert('청산 복구에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="p-6 max-w-3xl mx-auto">
      <Card className="bg-slate-900/70 border-slate-700">
        <CardHeader>
          <CardTitle>청산 복구</CardTitle>
          <CardDescription>가상 결제로 지갑을 복구합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
            <p className="text-xs text-muted-foreground">결제 금액</p>
            <p className="text-2xl font-semibold text-white">100,000원</p>
            <p className="text-xs text-muted-foreground">지급 금액</p>
            <p className="text-2xl font-semibold text-white">10,000,000원</p>
          </div>
          <p className="text-sm text-muted-foreground">
            실제 결제는 발생하지 않으며 내부 로그만 생성됩니다.
          </p>
          <Button loading={processing} onClick={handleReset}>
            가상 결제 리셋
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
