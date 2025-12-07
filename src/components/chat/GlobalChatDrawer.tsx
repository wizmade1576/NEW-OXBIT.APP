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
const RANDOM_ADJECTIVES = ['빛나는', '푸른', '은하수', '찬란한', '행복한', '별빛', '달빛', '무지개']
const RANDOM_NOUNS = ['여우', '호랑이', '토끼', '용', '상어', '비둘기', '고래', '나비']
const nicknameCache: Record<string, string> = {}

function generateRandomNickname() {
  const adjective = RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)]
  const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)]
  const suffix = Math.floor(Math.random() * 900) + 100
  return `${adjective}${noun}${suffix}`
}

function deriveNickname(user: User | null) {
  if (!user) return '익명'
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  if (metadata?.nickname) return String(metadata.nickname)
  if (!nicknameCache[user.id]) {
    nicknameCache[user.id] = generateRandomNickname()
  }
  return nicknameCache[user.id]
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
  const [profileNicknames, setProfileNicknames] = React.useState<Record<string, string>>({})

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
    const ids = Array.from(
      new Set(messages.map((msg) => msg.user_id).filter((id): id is string => Boolean(id))),
    ).filter((id) => !profileNicknames[id])

    if (ids.length === 0 || !isAuthenticated) return
    const supabase = getSupabase()
    if (!supabase) return

    let active = true
    supabase
      .from('user_profile')
      .select('id, nickname')
      .in('id', ids)
      .then(({ data }) => {
        if (!active || !data) return
        setProfileNicknames((prev) => {
          const next = { ...prev }
          for (const record of data) {
            if (record.id && record.nickname) {
              next[record.id] = record.nickname
            }
          }
          return next
        })
      })
      .catch((err) => console.error('Failed to load profile nicknames', err))

    return () => {
      active = false
    }
  }, [messages, profileNicknames, isAuthenticated])

  React.useEffect(() => {
    if (!open) return
    const container = listRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const getDisplayName = React.useCallback(
    (msg: ChatMessage) => {
      const byProfile = msg.user_id ? profileNicknames[msg.user_id] : undefined
      if (byProfile) return byProfile
      if (msg.nickname && !msg.nickname.includes('@')) return msg.nickname
      if (msg.user_id) {
        if (!nicknameCache[msg.user_id]) {
          nicknameCache[msg.user_id] = generateRandomNickname()
        }
        return nicknameCache[msg.user_id]
      }
      return '익명'
    },
    [profileNicknames],
  )

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

      if (error) {
        throw error
      }
      if (data) {
        appendMessage(data)
      }
      setInputValue('')
    } catch (err) {
      console.error('Failed to send chat message', err)
    } finally {
      setSending(false)
    }
  }

  const innerClasses = [
    'w-[min(95vw,360px)]',
    'max-h-[480px]',
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
  ]

  const stateClasses = open
    ? ['translate-y-0', 'opacity-100', 'pointer-events-auto']
    : ['translate-y-10', 'opacity-0', 'pointer-events-none']

  return (
    <div className="fixed bottom-10 right-4 z-50 pointer-events-none">
      <div
        className={[...innerClasses, ...stateClasses].join(' ')}
        style={{
          height: 'min(400px, 80vh)',
          paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm text-white">
            {loading ? (
              <p className="text-center text-muted-foreground">불러오는 중...</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground">채팅 기록이 없습니다.</p>
            ) : (
              messages.map((msg) => (
              <div key={msg.id} className="flex flex-col space-y-1 rounded-2xl border border-border/70 bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-white">{getDisplayName(msg)}</span>
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

        <form onSubmit={handleSubmit} className="border-t border-border px-4 pb-4 pt-3">
          <div className="flex gap-2">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={isAuthenticated ? '메시지를 입력하세요.' : '로그인 후 채팅 가능'}
              disabled={!isAuthenticated || sending}
              className="flex-1 rounded-2xl border border-border bg-[#0b0f15] px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="채팅 메시지 입력"
            />
            <button
              type="submit"
              disabled={!isAuthenticated || sending}
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              전송
            </button>
          </div>
          {!isAuthenticated && (
            <p className="mt-2 text-center text-xs text-muted-foreground">채팅 작성은 로그인 후 이용 가능한 서비스입니다.</p>
          )}
        </form>
      </div>
    </div>
  )
}
