import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

type ChatMessage = {
  id: string
  user_id: string
  nickname: string
  message: string
  created_at: string
}

const LIMIT = 200

function getNickname(user: User | null) {
  if (!user) return '익명'
  const meta = user.user_metadata as any
  const nick =
    meta?.nickname ||
    meta?.name ||
    user.email?.split('@')[0]

  return nick && nick.trim().length > 0 ? nick : '익명'
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function GlobalChatDrawerNew({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const nickname = React.useMemo(() => getNickname(user), [user])

  const listRef = React.useRef<HTMLDivElement>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [text, setText] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isLogin = Boolean(user?.id)
  const supabase = getSupabase()

  // ✅ 열릴 때만 메시지 로딩
  React.useEffect(() => {
    if (!open || !isLogin || !supabase) return

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('global_chat_new')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(LIMIT)

      setMessages(data ?? [])
      setLoading(false)
    }

    load()
  }, [open, isLogin, supabase])

  // ✅ Realtime 구독
  React.useEffect(() => {
    if (!open || !isLogin || !supabase) return

    const channel = supabase
      .channel('global-chat-new')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_chat_new' },
        (payload) => {
          setMessages((prev) =>
            [...prev, payload.new as ChatMessage].slice(-LIMIT),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, isLogin, supabase])

  // ✅ 자동 스크롤
  React.useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, open])

  // ✅ 전송
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !isLogin || !supabase) return

    setSending(true)
    setError(null)

    const { data: session } = await supabase.auth.getSession()

    if (!session?.session?.user?.id) {
      setError('로그인 세션이 만료되었습니다.')
      setSending(false)
      return
    }

    const payload = {
      user_id: session.session.user.id,
      nickname,
      message: text.trim(),
    }

    const { error } = await supabase
      .from('global_chat_new')
      .insert(payload)

    if (error) {
      setError('전송 실패 (권한 또는 네트워크 오류)')
    } else {
      setText('')
    }

    setSending(false)
  }

  if (!open) return null

  return (
    <>
      {/* ✅ 바깥 클릭 시 닫기 */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* ✅ 채팅창 */}
      <div
        className="
          fixed z-50
          left-4 right-4
          sm:left-auto sm:right-4
          bottom-[76px] sm:bottom-4
          w-auto sm:w-[360px]
          max-h-[45dvh] sm:h-[480px]
          bg-[#05070d]/95
          border border-border
          rounded-3xl
          flex flex-col
          overflow-hidden
        "
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ✅ 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-white font-semibold">OXBIT 채팅</span>
          <button
            onClick={onClose}
            className="text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* ✅ 메시지 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm"
        >
          {loading && <p className="text-center text-gray-400">불러오는 중...</p>}

          {!loading && messages.length === 0 && (
            <p className="text-center text-gray-400">채팅이 없습니다.</p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className="border border-white/10 bg-white/5 rounded-2xl p-3"
            >
              <div className="flex justify-between text-xs text-gray-400">
                <span className="font-semibold text-white">
                  {m.nickname || '익명'}
                </span>
                <span>
                  {new Date(m.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-white">{m.message}</p>
            </div>
          ))}
        </div>

        {/* ✅ 입력 */}
       <form onSubmit={send} className="px-3 py-2 border-t border-white/10">
  <div className="flex items-center gap-2">
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      disabled={!isLogin || sending}
      placeholder={isLogin ? '메시지 입력...' : '로그인 필요'}
      className="
        flex-1
        min-w-0
        rounded-xl
        bg-[#0b0f15]
        border
        border-white/10
        px-3
        py-2
        text-sm
        text-white
        placeholder:text-gray-400
        focus:outline-none
        focus:border-blue-400
      "
    />

    <button
      type="submit"
      disabled={!isLogin || sending}
      className="
        shrink-0
        px-3
        py-2
        rounded-xl
        bg-blue-500
        text-[13px]
        font-semibold
        text-black
        hover:bg-blue-400
        active:scale-95
        disabled:opacity-40
        disabled:cursor-not-allowed
      "
    >
      전송
    </button>
  </div>

  {error && (
    <p className="mt-2 text-xs text-red-400 text-center">
      {error}
    </p>
  )}
</form>

      </div>
    </>
  )
}
