import getSupabase from '../supabase/client'

export type BreakingRecord = {
  id: string
  title: string
  body?: string
  tag?: string
  source_link?: string
  created_at: string
  publish_at?: string | null
  pinned?: boolean | null
  status?: 'draft' | 'published' | 'archived' | null
  is_important?: boolean | null
}

export async function fetchBreaking(page = 1, pageSize = 20): Promise<BreakingRecord[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error } = await supabase
    .from('breaking_news')
    .select('*')
    .eq('status', 'published')
    .lte('publish_at', new Date().toISOString())
    .order('pinned', { ascending: false, nullsFirst: false })
    .order('publish_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data || []) as BreakingRecord[]
}

export async function fetchBreakingById(id: string): Promise<BreakingRecord | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('breaking_news')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return (data || null) as BreakingRecord | null
}

// Likes & Comments (admin posts only)
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export async function countLikes(breakingId: string): Promise<number> {
  const supabase = getSupabase()
  if (!supabase) return 0
  const { count } = await supabase
    .from('breaking_likes')
    .select('*', { count: 'exact', head: true })
    .eq('breaking_id', breakingId)
  return count ?? 0
}

export async function hasLiked(breakingId: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  const uid = await getCurrentUserId()
  if (!uid) return false
  const { count } = await supabase
    .from('breaking_likes')
    .select('*', { count: 'exact', head: true })
    .eq('breaking_id', breakingId)
    .eq('user_id', uid)
  return (count ?? 0) > 0
}

export async function like(breakingId: string): Promise<void> {
  const supabase = getSupabase()
  const uid = await getCurrentUserId()
  if (!supabase || !uid) throw new Error('로그인이 필요합니다')
  await supabase.from('breaking_likes').upsert({ breaking_id: breakingId, user_id: uid }, { onConflict: 'breaking_id,user_id' })
}

export async function unlike(breakingId: string): Promise<void> {
  const supabase = getSupabase()
  const uid = await getCurrentUserId()
  if (!supabase || !uid) throw new Error('로그인이 필요합니다')
  await supabase.from('breaking_likes').delete().eq('breaking_id', breakingId).eq('user_id', uid)
}

export type BreakingComment = {
  id: string
  breaking_id: string
  user_id: string
  body: string
  created_at: string
  updated_at?: string
}

export async function fetchComments(breakingId: string, limit = 100): Promise<BreakingComment[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('breaking_comments')
    .select('*')
    .eq('breaking_id', breakingId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return (data || []) as BreakingComment[]
}

export async function addComment(breakingId: string, body: string): Promise<BreakingComment | null> {
  const supabase = getSupabase()
  const uid = await getCurrentUserId()
  if (!supabase || !uid) throw new Error('로그인이 필요합니다')
  const { data, error } = await supabase
    .from('breaking_comments')
    .insert({ breaking_id: breakingId, user_id: uid, body })
    .select('*')
    .maybeSingle()
  if (error) return null
  return (data || null) as BreakingComment | null
}

export async function countComments(breakingId: string): Promise<number> {
  const supabase = getSupabase()
  if (!supabase) return 0
  const { count } = await supabase
    .from('breaking_comments')
    .select('*', { count: 'exact', head: true })
    .eq('breaking_id', breakingId)
  return count ?? 0
}

export default fetchBreaking
