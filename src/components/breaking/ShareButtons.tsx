import * as React from 'react'
import type { BreakingSharePayload } from '../../lib/share/breakingShare'

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
  const [copied, setCopied] = React.useState(false)

  const handleShare = React.useCallback(async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
    } catch {}
  }, [payload])

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(payload.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err: any) {
      alert(err?.message || '링크 복사에 실패했습니다.')
    }
  }, [payload.url])

  const rootClassName = className ? `${className} flex items-center gap-1` : 'flex items-center gap-1'
  return (
    <div className={rootClassName}>
      <button
        type="button"
        onClick={handleShare}
        disabled={!navigator.share}
        className={`rounded-md border border-border bg-accent/10 text-foreground hover:bg-accent ${sizeClasses[size]}`}
      >
        공유하기
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className={`rounded-md border border-border bg-transparent text-foreground/70 hover:border-foreground hover:text-foreground ${sizeClasses[size]}`}
      >
        {copied ? '복사됨' : '링크 복사'}
      </button>
    </div>
  )
}
