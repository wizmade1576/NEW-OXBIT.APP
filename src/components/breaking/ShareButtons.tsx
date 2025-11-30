import * as React from 'react'
import { shareViaKakao, shareViaTelegram, type BreakingSharePayload, isKakaoShareEnabled } from '../../lib/share/breakingShare'

type Props = {
  payload: BreakingSharePayload
  className?: string
  size?: 'sm' | 'xs'
}

const sizeClasses: Record<Props['size'], string> = {
  xs: 'text-[10px] px-2 py-0.5',
  sm: 'text-xs px-3 py-1',
}

export default function ShareButtons({ payload, className, size = 'sm' }: Props) {
  const [kakaoLoading, setKakaoLoading] = React.useState(false)

  const handleKakao = React.useCallback(async () => {
    try {
      setKakaoLoading(true)
      await shareViaKakao(payload)
    } catch (err: any) {
      alert(err?.message || '카카오톡 공유에 실패했습니다.')
    } finally {
      setKakaoLoading(false)
    }
  }, [payload])

  const handleTelegram = React.useCallback(() => {
    try {
      shareViaTelegram(payload)
    } catch (err: any) {
      alert(err?.message || '텔레그램 공유에 실패했습니다.')
    }
  }, [payload])

  const rootClassName = className ? `${className} flex items-center gap-1` : 'flex items-center gap-1'
  return (
    <div className={rootClassName}>
      <button
        type="button"
        onClick={handleKakao}
        disabled={!isKakaoShareEnabled || kakaoLoading}
        className={`rounded-md border border-border bg-yellow-500/10 text-amber-500 hover:border-amber-400 hover:bg-yellow-500/20 transition ${sizeClasses[size]}`}
      >
        카카오톡
      </button>
      <button
        type="button"
        onClick={handleTelegram}
        className={`rounded-md border border-border bg-white/5 text-foreground hover:border-foreground/40 hover:bg-accent/20 transition ${sizeClasses[size]}`}
      >
        텔레그램
      </button>
    </div>
  )
}
