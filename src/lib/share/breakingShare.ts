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
  id?: string | number
}) {
  const base = typeof window === 'undefined'
    ? 'https://oxbit.app'
    : window.location.origin

  // 🔥 UUID가 너무 길어서 → 앞 8자리만 사용
  let shortId = ''
  if (item.id) {
    const idStr = String(item.id)
    // admin-123 → 숫자만 추출 or uuid → 앞 8자만
    const raw = idStr.replace(/[^a-zA-Z0-9-]/g, '')
    shortId = raw.includes('-') ? raw.split('-')[0] : raw
  }

  // 최종 공유 URL
  const shareUrl = `${base}/breaking/${shortId}`

  // 카카오톡 + 텔레그램 공통 제목
  const titleLine = `${item.title} - OXBIT.APP`

  return {
    title: titleLine,
    description: item.body,
    url: shareUrl,
    text: `${titleLine}\n${shareUrl}`, // 🔥 링크 중복 제거 (단 1번만 표시)
  } satisfies BreakingSharePayload
}
