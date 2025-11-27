// Supabase Edge Function: aligo-send-otp
// Sends OTP via Aligo and stores the code in phone_otps

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const OTP_EXPIRE_MS = 5 * 60 * 1000
const MAX_PER_MINUTE = 5
const rateBucket = new Map<string, { count: number; ts: number }>()
const ALIGO_PROXY_URL = Deno.env.get('ALIGO_PROXY_URL') || ''
const ALIGO_PROXY_TOKEN = Deno.env.get('ALIGO_PROXY_TOKEN') || ''

type Json = Record<string, unknown>

function withCors(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-proxy-token',
    ...headers,
  }
}

function json(body: Json, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: withCors(init.headers) })
}

function normalizePhone(input: string) {
  const cleaned = input.replace(/[\s-]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('010')) return '+82' + cleaned.slice(1)
  return cleaned
}

function rateLimit(key: string) {
  const now = Date.now()
  const bucket = rateBucket.get(key) || { count: 0, ts: now }
  if (now - bucket.ts > 60 * 1000) {
    bucket.count = 0
    bucket.ts = now
  }
  bucket.count += 1
  rateBucket.set(key, bucket)
  return bucket.count <= MAX_PER_MINUTE
}

async function sendViaProxy(phone: string, code: string) {
  if (!ALIGO_PROXY_URL) throw new Error('missing_proxy_url')
  const payload = {
    phone,
    msg: `[OXBIT] 인증번호 ${code} (5분 이내 입력)`,
  }
  const headers: HeadersInit = { 'content-type': 'application/json' }
  if (ALIGO_PROXY_TOKEN) headers['x-proxy-token'] = ALIGO_PROXY_TOKEN

  const res = await fetch(ALIGO_PROXY_URL.replace(/\/$/, '') + '/send-otp', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`[aligo-send-otp] proxy send failed status=${res.status} body=${text}`)
    throw new Error(`proxy_send_failed:${res.status}`)
  }
  try {
    const json = JSON.parse(text)
    if (!json?.ok) {
      console.error(`[aligo-send-otp] proxy returned non-ok body=${text}`)
      throw new Error('proxy_send_failed')
    }
  } catch {
    console.error(`[aligo-send-otp] proxy returned invalid json body=${text}`)
    throw new Error('proxy_send_failed')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCors() })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

  try {
    const { phone } = await req.json().catch(() => ({})) as { phone?: string }
    const normalizedPhone = normalizePhone(phone || '')
    if (!normalizedPhone) return json({ error: 'invalid_phone' }, { status: 400 })

    const rateKey = normalizedPhone
    if (!rateLimit(rateKey)) return json({ error: 'rate_limited' }, { status: 429 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_credentials')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MS).toISOString()

    const { error: upsertError } = await supabase
      .from('phone_otps')
      .upsert({
        phone: normalizedPhone,
        code,
        expires_at: expiresAt,
        attempts: 0,
        verification_token: null,
        verification_expires_at: null,
      })

    if (upsertError) throw upsertError

    await sendViaProxy(normalizedPhone, code)

    return json({ ok: true })
  } catch (err: any) {
    console.error('[aligo-send-otp]', err)
    return json({ error: err?.message || 'internal_error' }, { status: 500 })
  }
})
