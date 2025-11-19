import * as React from 'react'
import { domainIcon, resolvePreviewImage } from '../../lib/news/preview'

interface Props {
  url: string
  image?: string
  className?: string
  imgClassName?: string
  alt?: string
}

export default function PreviewImage({ url, image, className = '', imgClassName = '', alt = '' }: Props) {
  const [src, setSrc] = React.useState<string | undefined>(image)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const best = await resolvePreviewImage(url, image)
        if (mounted) setSrc(best)
      } catch {
        if (mounted) setSrc(domainIcon(url))
      }
    })()
    return () => { mounted = false }
  }, [url, image])

  const onError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const fallback = domainIcon(url)
    if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback
  }

  return (
    <div className={(className || '') + ' overflow-hidden rounded-md bg-[#0b0f17]'}>
      {src ? (
        <img src={src} alt={alt} className={imgClassName || 'w-full h-full object-cover'} onError={onError} />
      ) : null}
    </div>
  )
}

