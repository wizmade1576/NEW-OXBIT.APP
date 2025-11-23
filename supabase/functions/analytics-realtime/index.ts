// Supabase Edge Function: analytics-realtime (SSE)
// Streams active session count (last 5 minutes) every 5 seconds.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const INTERVAL_MS = 5000
const WINDOW_MS = 5 * 60 * 1000

function withCors(headers: HeadersInit = {}) {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    ...headers,
  }
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: withCors() })
  if (req.method !== 'GET') return new Response('method_not_allowed', { status: 405, headers: withCors() })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('missing_supabase_credentials', { status: 500, headers: withCors() })
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      async function send() {
        const since = new Date(Date.now() - WINDOW_MS).toISOString()
        const res = await supabase
          .from('page_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'page_view')
          .gte('created_at', since)
        const count = res.count ?? 0
        const payload = `data: ${JSON.stringify({ realtimeVisitors: count, source: 'supabase' })}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      // First push
      send().catch(() => {})
      const timer = setInterval(() => send().catch(() => {}), INTERVAL_MS)

      controller.enqueue(new TextEncoder().encode(': connected\n\n'))

      const abort = req.signal
      abort.addEventListener('abort', () => {
        clearInterval(timer)
        controller.close()
      })
    },
  })

  return new Response(stream, { headers: withCors() })
})
