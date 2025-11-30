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

/* -------------------------------------------------------
   🔥 공유 URL + 텍스트 생성 (요청한 부분만 정확히 수정)
------------------------------------------------------- */
export function buildBreakingSharePayload(item: {
  title: string
  body?: string
  url?: string
  id?: number | string
}) {
  const base =
    typeof window === 'undefined'
      ? 'https://oxbit.app'
      : window.location.origin

  // 🔥 1) url은 무조건 id 기반 (key 절대 사용 ❌)
  const url = item.id
    ? `${base.replace(/\/$/, '')}/breaking/${item.id}`
    : `${base.replace(/\/$/, '')}/breaking`

  // 🔥 2) text 안에 URL 넣지 않음 → 카톡 미리보기 1개만
  const title = item.title
  const text = item.title

  return {
    title,
    description: item.body ?? '',
    url,   // URL은 한 번만
    text,  // 제목만 (URL 포함 금지)
  }
}
