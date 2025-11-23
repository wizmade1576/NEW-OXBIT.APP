// Supabase Edge Function: analytics-report
// Aggregates page_events for the admin dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

type GroupRow = { [key: string]: any }

function withCors(headers: HeadersInit = {}) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    ...headers,
  }
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: withCors(init.headers) })
}

function safeNumber(v: any) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCors() })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, { status: 405 })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_credentials')

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const since7 = new Date()
    since7.setDate(since7.getDate() - 7)
    const since5min = new Date(Date.now() - 5 * 60 * 1000)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Weekly visits (group by date)
    const weeklyRes = await supabase
      .from('page_events')
      .select('date:created_at::date, visitors:count()', { head: false })
      .eq('event_type', 'page_view')
      .gte('created_at', since7.toISOString())
      .group('date')
      .order('date', { ascending: true })

    // Top paths
    const topRes = await supabase
      .from('page_events')
      .select('path, hits:count()', { head: false })
      .eq('event_type', 'page_view')
      .gte('created_at', since7.toISOString())
      .group('path')
      .order('hits', { ascending: false })
      .limit(10)

    // Device share
    const deviceRes = await supabase
      .from('page_events')
      .select('device, value:count()', { head: false })
      .eq('event_type', 'page_view')
      .gte('created_at', since7.toISOString())
      .group('device')
      .order('value', { ascending: false })

    // Country share
    const countryRes = await supabase
      .from('page_events')
      .select('country, value:count()', { head: false })
      .eq('event_type', 'page_view')
      .gte('created_at', since7.toISOString())
      .group('country')
      .order('value', { ascending: false })
      .limit(10)

    // Realtime (last 5 minutes)
    const realtimeRes = await supabase
      .from('page_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', since5min.toISOString())

    const todayRes = await supabase
      .from('page_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', today.toISOString())

    if (weeklyRes.error) throw weeklyRes.error
    if (topRes.error) throw topRes.error
    if (deviceRes.error) throw deviceRes.error
    if (countryRes.error) throw countryRes.error
    if (realtimeRes.error) throw realtimeRes.error
    if (todayRes.error) throw todayRes.error

    const weeklyVisits =
      (weeklyRes.data as GroupRow[] | null)?.map((r) => ({
        date: r.date,
        visitors: safeNumber(r.visitors),
      })) ?? []

    const topPaths =
      (topRes.data as GroupRow[] | null)?.map((r) => ({
        path: r.path || '/',
        hits: safeNumber(r.hits),
      })) ?? []

    const deviceShare =
      (deviceRes.data as GroupRow[] | null)
        ?.filter((r) => r.device)
        .map((r) => ({
          name: r.device,
          value: safeNumber(r.value),
        })) ?? []

    const countryShare =
      (countryRes.data as GroupRow[] | null)
        ?.filter((r) => r.country)
        .map((r) => ({
          name: r.country,
          value: safeNumber(r.value),
      })) ?? []

    const realtimeVisitors = safeNumber(realtimeRes.count)
    const todayVisitors = safeNumber(todayRes.count)

    return json({
      weeklyVisits,
      topPaths,
      deviceShare,
      countryShare,
      realtimeVisitors,
      todayVisitors,
      source: 'supabase',
    })
  } catch (err) {
    console.error('[analytics-report]', err)
    return json(
      {
        weeklyVisits: [],
        topPaths: [],
        deviceShare: [],
        countryShare: [],
        realtimeVisitors: null,
        todayVisitors: null,
        error: String(err?.message || err),
      },
      { status: 200 },
    )
  }
})
