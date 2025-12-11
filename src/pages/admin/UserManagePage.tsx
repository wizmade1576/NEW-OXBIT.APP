import * as React from 'react'
import getSupabase from '../../lib/supabase/client'

type UserProfileRow = {
  id: string
  name: string | null
  nickname: string | null
  phone: string | null
  gender: string | null
  interest: string | null
  role: string | null
  created_at: string | null
  updated_at: string | null
}

type WalletInfo = {
  id: string
  user_id: string
  krw_balance: number
  is_liquidated: boolean
}

const INITIAL_WALLET_BALANCE = 10_000_000

export default function UserManagePage() {
  const [rows, setRows] = React.useState<UserProfileRow[]>([])
  const [wallets, setWallets] = React.useState<Record<string, WalletInfo | null>>({})
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [creatingWalletId, setCreatingWalletId] = React.useState<string | null>(null)
  const [depositUserId, setDepositUserId] = React.useState<string | null>(null)
  const [depositAmount, setDepositAmount] = React.useState('1000000')
  const [depositLoading, setDepositLoading] = React.useState(false)
  const [depositError, setDepositError] = React.useState<string | null>(null)

  const resolveAdminEndpoint = React.useCallback(() => {
    const configuredEndpoint = import.meta.env.VITE_ADMIN_USERS_ENDPOINT
    if (configuredEndpoint && !configuredEndpoint.includes('<')) return configuredEndpoint
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) return null
    const hostname = supabaseUrl.replace(/https?:\/\//, '').split('.')[0]
    if (!hostname) return null
    return `https://${hostname}.functions.supabase.co/admin-users`
  }, [])

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client unavailable')

      const sessionResponse = await supabase.auth.getSession()
      const accessToken = sessionResponse.data?.session?.access_token
      if (!accessToken) throw new Error('Authentication required')

      const baseUrl = resolveAdminEndpoint()
      if (!baseUrl) throw new Error('Admin endpoint not configured')

      const res = await fetch(`${baseUrl}?limit=200`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to fetch admin users')
      }
      const payload = await res.json()
      if (!payload?.ok) throw new Error(payload?.error || 'Failed to load user profiles')

      const userRows: UserProfileRow[] = payload.data ?? []
      setRows(userRows)

      if (userRows.length === 0) {
        setWallets({})
        return
      }

      const { data: walletData, error: walletError } = await supabase
        .from('paper_wallets')
        .select('id, user_id, krw_balance, is_liquidated')
        .in('user_id', userRows.map(row => row.id))

      if (walletError) {
        console.error('Failed to fetch wallets', walletError)
        setWallets({})
      } else {
        const map: Record<string, WalletInfo> = {}
        ;(walletData ?? []).forEach((wallet: any) => {
          map[wallet.user_id] = {
            id: wallet.id,
            user_id: wallet.user_id,
            krw_balance: wallet.krw_balance,
            is_liquidated: wallet.is_liquidated,
          }
        })
        setWallets(map)
      }
    } catch (err: any) {
      console.error('[UserManagePage] loadUsers', err)
      setLoadError('회원 목록을 가져오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [resolveAdminEndpoint])

  React.useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreateWallet = React.useCallback(
    async (userId: string) => {
      setCreatingWalletId(userId)
      try {
        const supabase = getSupabase()
        if (!supabase) throw new Error('Supabase client unavailable')

        const { data, error } = await supabase
          .from('paper_wallets')
          .insert({
            user_id: userId,
            krw_balance: INITIAL_WALLET_BALANCE,
            is_liquidated: false,
          })
          .select('id, user_id, krw_balance, is_liquidated')
          .single()

        if (error || !data) {
          console.error(error)
          alert('지갑 생성 중 오류가 발생했습니다.')
          return
        }

        setWallets(prev => ({
          ...prev,
          [userId]: {
            id: data.id,
            user_id: data.user_id,
            krw_balance: data.krw_balance,
            is_liquidated: data.is_liquidated,
          },
        }))

        alert('기본 증거금 1,000만 원이 있는 지갑이 생성되었습니다.')
      } catch (error) {
        console.error(error)
        alert('지갑 생성 중 오류가 발생했습니다.')
      } finally {
        setCreatingWalletId(null)
      }
    },
    [],
  )

  const openDepositModal = React.useCallback(
    (userId: string) => {
      setDepositUserId(userId)
      setDepositAmount('1000000')
      setDepositError(null)
    },
    [],
  )

  const handleDeposit = React.useCallback(async () => {
    if (!depositUserId) return
    const wallet = wallets[depositUserId]
    if (!wallet) return
    const amount = Number(depositAmount)
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setDepositError('입금 금액을 0보다 크게 입력해 주세요.')
      return
    }
    setDepositLoading(true)
    setDepositError(null)
    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Supabase client unavailable')

      const newBalance = wallet.krw_balance + amount
      const { error } = await supabase
        .from('paper_wallets')
        .update({
          krw_balance: newBalance,
          is_liquidated: false,
        })
        .eq('id', wallet.id)

      if (error) {
        console.error(error)
        setDepositError('입금 처리 중 오류가 발생했습니다.')
        return
      }

      setWallets(prev => ({
        ...prev,
        [depositUserId]: {
          ...wallet,
          krw_balance: newBalance,
          is_liquidated: false,
        },
      }))

      alert('증거금 입금이 완료되었습니다.')
      setDepositUserId(null)
    } catch (error) {
      console.error(error)
      setDepositError('입금 처리 중 오류가 발생했습니다.')
    } finally {
      setDepositLoading(false)
    }
  }, [depositAmount, depositUserId, wallets])

  const selectedWallet = depositUserId ? wallets[depositUserId] ?? null : null

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">회원 관리</h1>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-[#0b0f15]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {[
                '순서',
                '이름',
                '닉네임',
                '전화번호',
                '성별',
                '관심사',
                '권한',
                '가입일',
                '지갑 잔고 (KRW)',
                '청산 상태',
                '증거금',
              ].map(label => (
                <th key={label} className="px-4 py-3 text-left">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  아직 회원 정보가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const wallet = wallets[row.id] ?? null
                const balanceLabel = wallet
                  ? `${wallet.krw_balance.toLocaleString('ko-KR')} 원`
                  : '지갑 없음'
                const statusLabel = wallet ? (
                  wallet.is_liquidated ? (
                    <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] text-red-300">
                      청산됨
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                      정상
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )

                return (
                  <tr key={row.id} className="border-t border-border hover:bg-white/5">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">{row.name ?? '미등록'}</td>
                    <td className="px-4 py-3">{row.nickname ?? '미등록'}</td>
                    <td className="px-4 py-3">{row.phone ?? '미등록'}</td>
                    <td className="px-4 py-3">{row.gender ?? '미입력'}</td>
                    <td className="px-4 py-3">{row.interest ?? '미입력'}</td>
                    <td className="px-4 py-3">{row.role ?? 'user'}</td>
                    <td className="px-4 py-3">
                      {row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3">{balanceLabel}</td>
                    <td className="px-4 py-3">{statusLabel}</td>
                    <td className="px-4 py-3">
                      {wallet ? (
                        <button
                          type="button"
                          onClick={() => openDepositModal(row.id)}
                          className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700"
                        >
                          입금
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCreateWallet(row.id)}
                          className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                          disabled={creatingWalletId === row.id}
                        >
                          {creatingWalletId === row.id ? '생성 중…' : '지갑 생성'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-border bg-[#0b0f15] px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">로딩 중...</p>}

      {depositUserId && selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-[#0b0f15] p-6 text-sm text-white">
            <h2 className="mb-3 text-lg font-semibold text-white">증거금 입금</h2>
            <p className="text-[13px] text-slate-300">
              현재 잔고: {selectedWallet.krw_balance.toLocaleString('ko-KR')} 원
            </p>
            {selectedWallet.is_liquidated && (
              <p className="mt-2 text-xs text-red-300">
                이 지갑은 청산 상태입니다. 입금 시 자동으로 &quot;정상&quot; 상태로 전환됩니다.
              </p>
            )}
            <div className="mt-4 space-y-2">
              <label className="text-xs text-slate-400">입금 금액 (KRW)</label>
              <input
                type="number"
                min={0}
                step={10000}
                value={depositAmount}
                onChange={event => setDepositAmount(event.target.value)}
                className="w-full rounded-md border border-border bg-[#05070b] px-3 py-2 text-sm text-white"
              />
              {depositError && <p className="text-xs text-red-300">{depositError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDepositUserId(null)}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
                disabled={depositLoading}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeposit}
                className="rounded-full border border-emerald-400 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50"
                disabled={depositLoading}
              >
                {depositLoading ? '입금 처리 중…' : '입금 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
