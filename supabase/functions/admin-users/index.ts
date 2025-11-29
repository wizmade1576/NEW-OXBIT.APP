import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...init.headers },
  })
}

function sanitizeSearch(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

async function getSessionUser(supabase: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await supabase.auth.getUser(token)
  if (error) throw error
  if (!data?.user) throw new Error('not_authenticated')
  return data.user
}

async function assertAdmin(supabase: ReturnType<typeof createClient>, uid: string) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).single()
  if (error) throw error
  if (!data || data.role !== 'admin') throw new Error('forbidden')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, { status: 405 })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('missing_supabase_env')

    const authHeader = req.headers.get('authorization') || ''
    const tokenMatch = authHeader.match(/Bearer\s+(.+)/i)
    if (!tokenMatch) return json({ ok: false, error: 'authorization_required' }, { status: 401 })
    const token = tokenMatch[1].trim()

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const user = await getSessionUser(supabase, token)
    await assertAdmin(supabase, user.id)

    const requestUrl = new URL(req.url)
    const rawSearch = requestUrl.searchParams.get('search') || ''
    const cleanSearch = sanitizeSearch(rawSearch)
    const page = Math.max(1, Number(requestUrl.searchParams.get('page') || '1'))
    let limit = Number(requestUrl.searchParams.get('limit') || '10')
    limit = Number.isFinite(limit) ? Math.min(Math.max(limit, 5), 100) : 10

    let query = supabase
      .from('user_profile')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`
      query = query.ilike('name', pattern).or(`nickname.ilike.${pattern}`).or(`phone.ilike.${pattern}`)
    }

    const offset = (page - 1) * limit
    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    return json({
      ok: true,
      data: data ?? [],
      count: typeof count === 'number' ? count : data?.length ?? 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('[admin-users]', error)
    const message = (error as Error).message || 'server_error'
    const status = message === 'missing_supabase_env' ? 500 : message === 'forbidden' ? 403 : message === 'authorization_required' ? 401 : 500
    return json({ ok: false, error: message }, { status })
  }
})
