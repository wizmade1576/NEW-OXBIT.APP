const KAKAO_JS_KEY = (import.meta as any).env?.VITE_KAKAO_JS_KEY

type KakaoGlobal = typeof window & { Kakao?: any }

let kakaoInitPromise: Promise<void> | null = null

function loadKakaoSdk(): Promise<void> {
  if (kakaoInitPromise) return kakaoInitPromise
  kakaoInitPromise = new Promise((resolve, reject) => {
    if ((window as KakaoGlobal).Kakao) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js'
    script.async = true
    script.onload = () => {
      if ((window as KakaoGlobal).Kakao) {
        resolve()
      } else {
        reject(new Error('Kakao SDK failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Kakao SDK failed to load'))
    document.head.appendChild(script)
  })
  return kakaoInitPromise
}

export interface BreakingSharePayload {
  title: string
  description?: string
  url: string
  text: string
  imageUrl?: string
}

export const isKakaoShareEnabled = Boolean(KAKAO_JS_KEY)

export async function shareViaKakao(payload: BreakingSharePayload) {
  if (!isKakaoShareEnabled) throw new Error('Kakao sharing is not configured')
  await loadKakaoSdk()
  const kakao = (window as KakaoGlobal).Kakao
  if (!kakao) throw new Error('Kakao SDK loading failed')
  if (!kakao.isInitialized()) {
    kakao.init(KAKAO_JS_KEY)
  }
  kakao.Link.sendDefault({
    objectType: 'feed',
    content: {
      title: payload.title,
      description: payload.description ?? 'OXBIT.APP Breaking 뉴스',
      imageUrl: payload.imageUrl ?? `${window.location.origin}/og.png`,
      link: {
        mobileWebUrl: payload.url,
        webUrl: payload.url,
      },
    },
      buttons: [
        {
          title: '자세히 보기',
          link: {
            mobileWebUrl: payload.url,
            webUrl: payload.url,
          },
        },
      ],
    })
  }

  export function shareViaTelegram(payload: BreakingSharePayload) {
    const textParts = [payload.title]
    if (payload.description) textParts.push(payload.description)
    textParts.push(payload.url)
  const text = textParts.filter(Boolean).join('\n')
  const params = new URLSearchParams({
    url: payload.url,
    text,
  })
  const shareUrl = `https://t.me/share/url?${params.toString()}`
  window.open(shareUrl, '_blank', 'noopener')
}

export function buildBreakingSharePayload(item: {
  title: string
  body?: string
  url?: string
  id?: number
}) {
  const base = typeof window === 'undefined' ? 'https://oxbit.app' : `${window.location.origin}`
  const numericPath = item.id ? `${base.replace(/\/$/, '')}/breaking/${item.id}` : `${base.replace(/\/$/, '')}/breaking`
  const url = item.url || numericPath
  const titleLine = `${item.title} - OXBIT.APP`
  const text = `${titleLine}\n${url}`
  return {
    title: titleLine,
    description: item.body,
    url,
    text,
  } satisfies BreakingSharePayload
}
