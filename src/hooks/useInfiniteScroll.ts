import * as React from 'react'

export interface UseInfiniteScrollOptions {
  rootMargin?: string
  disabled?: boolean
  onIntersect?: () => void
}

export function useInfiniteScroll({ rootMargin = '400px', disabled, onIntersect }: UseInfiniteScrollOptions) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [isIntersecting, setIntersecting] = React.useState(false)

  React.useEffect(() => {
    if (disabled) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const vis = !!entry?.isIntersecting
        setIntersecting(vis)
        if (vis) onIntersect?.()
      },
      { root: null, rootMargin, threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, disabled, onIntersect])

  return { ref, isIntersecting }
}

export default useInfiniteScroll

