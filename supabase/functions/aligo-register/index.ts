// Supabase Edge Function: aligo-register
// Registers a user by phone/password after OTP verification via phone_otps

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

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
    const body = await req.json().catch(() => ({})) as {
      email?: string
      phone?: string
      password?: string
      name?: string
      nickname?: string
      gender?: string
      interest?: string
      verificationToken?: string
    }

    const normalizedPhone = normalizePhone(body.phone || '')
    const password = body.password || ''
    const email = body.email?.toString().trim().toLowerCase() || ''
    if (!normalizedPhone || !password) return json({ error: 'invalid_input' }, { status: 400 })
    if (!body.verificationToken) return json({ error: 'verification_required' }, { status: 400 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_credentials')
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: otpRow, error: otpErr } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', normalizedPhone)
      .single()
    if (otpErr || !otpRow) return json({ error: 'otp_not_found' }, { status: 400 })

    const now = Date.now()
    const vExp = otpRow.verification_expires_at ? new Date(otpRow.verification_expires_at).getTime() : 0
    if (!otpRow.verification_token || otpRow.verification_token !== body.verificationToken || now > vExp) {
      return json({ error: 'verification_expired' }, { status: 400 })
    }

    const userMetadata = {
      name: body.name || null,
      nickname: body.nickname || null,
      gender: body.gender || null,
      interest: body.interest || null,
      phone: normalizedPhone,
      email: email || null,
    }

    const { data: createRes, error: createErr } = await supabase.auth.admin.createUser({
      email: email || undefined,
      email_confirm: !!email,
      phone: normalizedPhone,
      phone_confirm: true,
      password,
      user_metadata: userMetadata,
    })
    if (createErr) {
      return json({ error: createErr.message || 'create_failed' }, { status: 400 })
    }

    const userId = createRes?.user?.id
    if (userId) {
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: body.name || null,
          nickname: body.nickname || null,
          gender: body.gender || null,
          interest: body.interest || null,
          phone: normalizedPhone,
          email: email || null,
        })
        .eq('id', userId)
        .catch(() => {})
    }

    await supabase
      .from('phone_otps')
      .update({ verification_token: null, verification_expires_at: null })
      .eq('phone', normalizedPhone)
      .catch(() => {})

    return json({ ok: true, userId })
  } catch (err: any) {
    console.error('[aligo-register]', err)
    return json({ error: err?.message || 'internal_error' }, { status: 500 })
  }
})
