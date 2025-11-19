// utils/time.ts
// 서버에서 UTC 기반 입력을 KST(UTC+9)로 변환하고, 사람이 읽기 쉬운 문자열로 포맷합니다.

export type DateInput = string | number | Date | undefined | null

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input
  if (typeof input === 'number') return new Date(input)
  if (typeof input === 'string') return new Date(input)
  return new Date(NaN)
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// 1) UTC → KST(+9시간) 변환
export function toKST(input: DateInput): Date {
  const d = toDate(input)
  const t = d.getTime()
  if (Number.isNaN(t)) return new Date(NaN)
  return new Date(t + 9 * 60 * 60 * 1000)
}

// 2) 최종 KST 날짜를 사람이 읽기 좋은 형식으로 변환
export function toKSTString(input: DateInput): string {
  const k = toKST(input)
  if (Number.isNaN(k.getTime())) return ''

  // 여기서 절대 getUTC*() 사용하면 안 됨 !!!!
  const y = k.getFullYear()
  const m = pad(k.getMonth() + 1)
  const d = pad(k.getDate())
  const hh = pad(k.getHours())
  const mm = pad(k.getMinutes())

  return `${y}.${m}.${d} ${hh}:${mm}`
}
