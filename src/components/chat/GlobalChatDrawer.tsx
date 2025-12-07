import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import getSupabase from '../../lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

type ChatMessage = {
  id: string
  user_id: string | null
  nickname: string | null
  message: string
  created_at: string | null
}

const MESSAGE_LIMIT = 200

function deriveNickname(user: User | null) {
  if (!user) return '익명'
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  return (
    (metadata?.nickname as string | undefined) ??
    (metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    '익명'
  )
}

type GlobalChatDrawerProps = {
  open: boolean
  onClose: () => void
}

export default function GlobalChatDrawer({ open, onClose }: GlobalChatDrawerProps) {
  const user = useAuthStore((s) => s.user)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const isAuthenticated = Boolean(user?.id)
  const nickname = React.useMemo(() => deriveNickname(user), [user])

  const appendMessage = React.useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === incoming.id)) return prev
      return [...prev, incoming].slice(-MESSAGE_LIMIT)
    })
  }, [])

  const loadMessages = React.useCallback(async () => {
    if (!isAuthenticated) {
      setMessages([])
      setLoading(false)
      return
    }
    const supabase = getSupabase()
    if (!supabase) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_chat')
        .select('id, user_id, nickname, message, created_at')
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT)

      if (error) throw error
      const ordered = (data ?? []).slice().reverse()
      setMessages(ordered)
    } catch (err) {
      console.error('Failed to load global chat', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  React.useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  React.useEffect(() => {
    if (!isAuthenticated) return
    const supabase = getSupabase()
    if (!supabase) return

    const channel = supabase
      .channel('global-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_chat' },
        (payload) => {
          const incoming = payload.new as ChatMessage
          appendMessage(incoming)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAuthenticated, appendMessage])

  React.useEffect(() => {
    if (!open) return
    const container = listRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inputValue.trim() || !isAuthenticated) return
    setSending(true)
    const supabase = getSupabase()
    if (!supabase) {
      setSending(false)
      return
    }

    const payload = {
      user_id: user?.id,
      nickname,
      message: inputValue.trim(),
    }

    try {
      const { data, error } = await supabase
        .from('global_chat')
        .insert(payload)
        .select('id, user_id, nickname, message, created_at')
        .single()

      if (error) throw error
      if (data) appendMessage(data)
      setInputValue('')
    } catch (err) {
      console.error('Failed to send chat message', err)
    } finally {
      setSending(false)
    }
  }

  // ✅ 모바일 + iPhone 16 + PC 대응 높이/폭
  const innerClasses = [
    'w-full',
    'sm:w-[360px]',
    'max-h-[50dvh]',
    'sm:h-[480px]',
    'transition-all',
    'duration-300',
    'shadow-2xl',
    'backdrop-blur',
    'rounded-3xl',
    'border',
    'border-border',
    'bg-[#05070d]/90',
    'flex',
    'flex-col',
    'overflow-hidden',
  ]

  const stateClasses = open
    ? ['translate-y-0', 'opacity-100', 'pointer-events-auto']
    : ['translate-y-10', 'opacity-0', 'pointer-events-none']

  return (
    <div
      className="
        fixed
        right-4
        left-4
        sm:left-auto
        bottom-[64px]
        sm:bottom-4
        z-50
        pointer-events-none
      "
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className={[...innerClasses, ...stateClasses].join(' ')}>
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-white">OXBIT 채팅</p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="채팅 닫기"
          >
            ✕
          </button>
        </div>

        {/* 메시지 리스트 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm text-white"
        >
          {loading ? (
            <p className="text-center text-muted-foreground">불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground">채팅 기록이 없습니다.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="flex flex-col space-y-1 rounded-2xl border border-border/70 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-white">
                    {(() => {
                      const raw = msg.nickname?.trim()
                      if (raw && raw.length > 0) return raw
                      return '익명'
                    })()}
                  </span>
                  <span>
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-white">{msg.message}</p>
              </div>
            ))
          )}
        </div>

        {/* ✅ iPhone 16 가로 safe-area + 전송 버튼 잘림 해결 */}
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-border px-4 pb-4 pt-3"
          style={{
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          <div className="flex gap-2 items-center min-w-0">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={isAuthenticated ? '메시지를 입력하세요.' : '로그인 후 채팅 가능'}
              disabled={!isAuthenticated || sending}
              className="
                flex-1
                min-w-0
                rounded-2xl
                border
                border-border
                bg-[#0b0f15]
                px-3
                py-2
                text-sm
                text-white
                placeholder:text-muted-foreground
                focus:border-primary
                focus:outline-none
                focus:ring-1
                focus:ring-primary
              "
            />
            <button
              type="submit"
              disabled={!isAuthenticated || sending}
              className="
                shrink-0
                inline-flex
                items-center
                justify-center
                rounded-full
                bg-primary
                px-4
                py-2
                mr-2
                text-sm
                font-semibold
                text-background
                transition
                hover:bg-primary/90
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              전송
            </button>
          </div>

          {!isAuthenticated && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              채팅 작성은 로그인 후 이용 가능한 서비스입니다.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
