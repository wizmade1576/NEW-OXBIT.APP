// Supabase Edge Function: aligo-verify-otp
// Verifies OTP from phone_otps and issues a verification token

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const MAX_ATTEMPTS = 5
const VERIFY_TOKEN_EXPIRE_MS = 10 * 60 * 1000

type Json = Record<string, unknown>

function withCors(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCors() })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

  try {
    const { phone, code } = await req.json().catch(() => ({})) as { phone?: string; code?: string }
    const normalizedPhone = normalizePhone(phone || '')
    if (!normalizedPhone || !code) return json({ error: 'invalid_input' }, { status: 400 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_credentials')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: row, error: fetchError } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', normalizedPhone)
      .single()

    if (fetchError || !row) return json({ error: 'otp_not_found' }, { status: 400 })

    const now = Date.now()
    const expiresAt = new Date(row.expires_at).getTime()
    if (now > expiresAt) return json({ error: 'otp_expired' }, { status: 400 })
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: 'too_many_attempts' }, { status: 429 })

    if (row.code !== String(code).trim()) {
      await supabase.from('phone_otps').update({ attempts: row.attempts + 1 }).eq('phone', normalizedPhone)
      return json({ error: 'otp_mismatch' }, { status: 400 })
    }

    const verificationToken = crypto.randomUUID()
    const verificationExpiresAt = new Date(now + VERIFY_TOKEN_EXPIRE_MS).toISOString()

    const { error: updateError } = await supabase
      .from('phone_otps')
      .update({
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt,
        attempts: row.attempts + 1,
      })
      .eq('phone', normalizedPhone)

    if (updateError) throw updateError

    return json({ ok: true, verificationToken })
  } catch (err: any) {
    console.error('[aligo-verify-otp]', err)
    return json({ error: err?.message || 'internal_error' }, { status: 500 })
  }
})
