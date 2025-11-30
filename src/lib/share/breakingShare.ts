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
   🔥 공유 URL + 텍스트 생성 (핵심 수정 부분)
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

  // ID 기반 짧은 URL
  const url = item.id
    ? `${base.replace(/\/$/, '')}/breaking/${item.id}`
    : `${base.replace(/\/$/, '')}/breaking`

  // 🔥 제목만 (OXBIT.APP 제거)
  const title = item.title

  // 🔥 text 안에 URL 넣지 말기 → 카톡에서 URL 1개만 파싱됨
  const text = title

  return {
    title,
    description: item.body ?? '',
    url,   // URL은 딱 1번만
    text,  // 제목만 → 링크 중복 미리보기 방지
  }
}
