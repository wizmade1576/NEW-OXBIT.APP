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

export default fetchBreaking

