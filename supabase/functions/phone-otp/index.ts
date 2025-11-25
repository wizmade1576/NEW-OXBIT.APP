// Phone OTP Edge Function (Twilio -> Aligo 교체)  [변경 부분 전체]
// - POST /?action=send   { phone: string }
// - POST /?action=verify { phone: string, code: string }
// 환경변수: ALIGO_USER_ID, ALIGO_API_KEY, ALIGO_SENDER, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

type Body = { phone?: string; code?: string; action?: 'send' | 'verify' }
type JsonResp =
  | { ok: true; message: string }
  | { ok: false; error: string; message?: string }

const OTP_EXP_MS = 5 * 60 * 1000 // 5분
const RATE_MS = 30 * 1000 // 동일 번호 연속 요청 제한 (기존보다 3~4배 완화) [변경]
const TABLE = 'phone_otps'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type',
}

function json(body: JsonResp, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...init.headers },
  })
}

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[\s-]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('010')) return '+82' + cleaned.slice(1)
  return cleaned
}

function randomCode(len = 6) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('')
}

async function sendAligo({ phone, code }: { phone: string; code: string }) {
  const userid = Deno.env.get('ALIGO_USER_ID') || ''
  const key = Deno.env.get('ALIGO_API_KEY') || ''
  const sender = Deno.env.get('ALIGO_SENDER') || ''
  if (!userid || !key || !sender) throw new Error('missing_aligo_env')

  const msg = `[OXBIT] 인증번호 ${code}를 입력해 주세요. (5분 이내 유효)`
  const params = new URLSearchParams({
    key,
    userid,
    sender,
    receiver: phone,
    msg,
    msg_type: 'SMS',
  })

  const res = await fetch('https://apis.aligo.in/send/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = await res.json().catch(() => null)
  const resultCode = String(data?.result_code ?? '')
  if (!res.ok || resultCode !== '1') {
    throw new Error(`aligo_failed:${resultCode || res.status}`)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, { status: 405 })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_env')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body: Body = await req.json().catch(() => ({}))
    const action = body.action || 'send'
    const phone = normalizePhone(body.phone || '')
    if (!phone || !/^\+?\d{9,15}$/.test(phone)) {
      return json({ ok: false, error: 'invalid_phone', message: '전화번호 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    // 최신 요청 가져오기 (rate limit)
    const { data: existing } = await supabase
      .from(TABLE)
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const now = Date.now()

    if (action === 'send') {
      if (existing?.created_at && now - Date.parse(existing.created_at) < RATE_MS) {
        return json({ ok: false, error: 'too_many_requests', message: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
      }
      const code = randomCode(6)
      const expiresAt = new Date(now + OTP_EXP_MS).toISOString()

      await sendAligo({ phone, code }) // 변경: Twilio → Aligo 호출

      const { error: upsertErr } = await supabase
        .from(TABLE)
        .upsert({ phone, code, expires_at: expiresAt, created_at: new Date(now).toISOString(), attempts: 0 })
      if (upsertErr) throw upsertErr

      return json({ ok: true, message: '인증번호가 발송되었습니다.' })
    }

    if (action === 'verify') {
      const code = (body.code || '').trim()
      if (!code) {
        return json({ ok: false, error: 'code_required', message: '인증번호를 입력해 주세요.' }, { status: 400 })
      }
      if (!existing) return json({ ok: false, error: 'code_not_found', message: '인증번호를 다시 요청해 주세요.' }, { status: 404 })
      if (existing.expires_at && now > Date.parse(existing.expires_at)) {
        return json({ ok: false, error: 'code_expired', message: '인증번호가 만료되었습니다.' }, { status: 410 })
      }
      if (existing.code !== code) {
        const attempts = (existing.attempts || 0) + 1
        await supabase.from(TABLE).update({ attempts }).eq('phone', phone)
        return json({ ok: false, error: 'code_mismatch', message: '인증번호가 일치하지 않습니다.' }, { status: 400 })
      }
      await supabase.from(TABLE).delete().eq('phone', phone) // 성공 시 정리 (메모리/중복 방지)
      return json({ ok: true, message: '전화번호 인증이 완료되었습니다.' })
    }

    return json({ ok: false, error: 'invalid_action' }, { status: 400 })
  } catch (err) {
    console.error('[phone-otp]', err)
    const msg = typeof err?.message === 'string' ? err.message : String(err)
    const status = msg.startsWith('aligo_failed') ? 502 : msg === 'missing_supabase_env' ? 500 : 500
    return json({ ok: false, error: msg || 'server_error' }, { status })
  }
})
