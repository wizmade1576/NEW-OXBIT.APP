// Supabase Edge Function: analytics-track
// Ingests page events into public.page_events

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

type EventPayload = {
  path?: string
  userId?: string | null
  ua?: string | null
  country?: string | null
  device?: string | null
  eventType?: string | null
  meta?: Record<string, unknown>
}

const rateBucket = new Map<string, { count: number; ts: number }>()
const RATE_LIMIT = 120 // events per ip per 60s
const WINDOW_MS = 60 * 1000

function withCors(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-analytics-secret',
    ...headers,
  }
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: withCors(init.headers) })
}

function detectDevice(h: Headers, ua: string) {
  const cf = h.get('cf-device-type')
  if (cf) return cf.toLowerCase()
  const mobile = h.get('sec-ch-ua-mobile')
  if (mobile && mobile.toLowerCase().includes('?1')) return 'mobile'
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectCountry(h: Headers) {
  return h.get('cf-ipcountry') || h.get('x-country') || null
}

function rateLimit(ip: string) {
  const now = Date.now()
  const bucket = rateBucket.get(ip) || { count: 0, ts: now }
  if (now - bucket.ts > WINDOW_MS) {
    bucket.count = 0
    bucket.ts = now
  }
  bucket.count += 1
  rateBucket.set(ip, bucket)
  return bucket.count <= RATE_LIMIT
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCors() })

  try {
    const secret = Deno.env.get('ANALYTICS_INGEST_SECRET') || ''
    if (secret && req.headers.get('x-analytics-secret') !== secret) {
      return json({ error: 'unauthorized' }, { status: 401 })
    }

    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_credentials')

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) return json({ error: 'rate_limited' }, { status: 429 })

    const body: EventPayload = await req.json().catch(() => ({}))
    const path = (body.path || '').slice(0, 2048).trim()
    if (!path) return json({ error: 'path_required' }, { status: 400 })

    const ua = (body.ua || req.headers.get('user-agent') || '').slice(0, 1024)
    const country = (body.country || detectCountry(req.headers) || '').slice(0, 64) || null
    const device = (body.device || detectDevice(req.headers, ua) || '').slice(0, 64) || null
    const userId = body.userId ? String(body.userId).slice(0, 128) : null
    const eventType = (body.eventType || 'page_view').slice(0, 64)
    const meta = body.meta && typeof body.meta === 'object' ? body.meta : {}

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { error } = await supabase.from('page_events').insert({
      path,
      ua,
      country,
      device,
      user_id: userId,
      event_type: eventType,
      meta,
      ip,
    })

    if (error) throw error

    return json({ ok: true })
  } catch (err) {
    console.error('[analytics-track]', err)
    return json({ error: String(err?.message || err) }, { status: 500 })
  }
})
