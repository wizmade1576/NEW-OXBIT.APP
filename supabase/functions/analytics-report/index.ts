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

    const url = new URL(req.url)
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    const toDate = toParam ? new Date(toParam) : new Date()
    toDate.setHours(23, 59, 59, 999)
    const fromDate = fromParam ? new Date(fromParam) : new Date(toDate)
    if (!fromParam) {
      fromDate.setDate(toDate.getDate() - 29) // default 30일(오늘 포함)
    }
    fromDate.setHours(0, 0, 0, 0)

    const since5min = new Date(Date.now() - 5 * 60 * 1000)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch events for the requested range once, then aggregate in JS (avoid `.group` runtime issue)
    const eventsRes = await supabase
      .from('page_events')
      .select('path, device, country, ip, created_at', { head: false })
      .eq('event_type', 'page_view')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString())

    if (eventsRes.error) throw eventsRes.error

    const weeklyMap = new Map<string, number>()
    const pathMap = new Map<string, number>()
    const deviceMap = new Map<string, number>()
    const countryMap = new Map<string, number>()
    const uniqueDailyMap = new Map<string, Set<string>>()

    ;(eventsRes.data as GroupRow[] | null)?.forEach((row) => {
      const date = (row.created_at || '').slice(0, 10)
      if (date) weeklyMap.set(date, (weeklyMap.get(date) || 0) + 1)
      if (date) {
        if (!uniqueDailyMap.has(date)) uniqueDailyMap.set(date, new Set())
        const ip = (row.ip || 'unknown').toString().slice(0, 128)
        uniqueDailyMap.get(date)!.add(ip)
      }

      const path = row.path || '/'
      pathMap.set(path, (pathMap.get(path) || 0) + 1)

      const device = row.device || 'unknown'
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1)

      const country = row.country || 'unknown'
      countryMap.set(country, (countryMap.get(country) || 0) + 1)
    })

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

    if (realtimeRes.error) throw realtimeRes.error
    if (todayRes.error) throw todayRes.error

    const weeklyVisits = Array.from(weeklyMap.entries())
      .map(([date, visitors]) => ({ date, visitors: safeNumber(visitors) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const topPaths = Array.from(pathMap.entries())
      .map(([path, hits]) => ({ path, hits: safeNumber(hits) }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10)

    const deviceShare = Array.from(deviceMap.entries())
      .filter(([name]) => !!name)
      .map(([name, value]) => ({ name, value: safeNumber(value) }))
      .sort((a, b) => b.value - a.value)

    const countryShare = Array.from(countryMap.entries())
      .filter(([name]) => !!name)
      .map(([name, value]) => ({ name, value: safeNumber(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const dailyUniqueVisitors = Array.from(uniqueDailyMap.entries())
      .map(([date, set]) => ({ date, uniqueVisitors: set.size }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const realtimeVisitors = safeNumber(realtimeRes.count)
    const todayVisitors = safeNumber(todayRes.count)

    return json({
      weeklyVisits,
      topPaths,
      deviceShare,
      countryShare,
      dailyUniqueVisitors,
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
        dailyUniqueVisitors: [],
        realtimeVisitors: null,
        todayVisitors: null,
        error: String(err?.message || err),
      },
      { status: 200 },
    )
  }
})
