import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('Missing Supabase env: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    }
    return null
  }

  if (!client) {
    client = createClient(url as string, anonKey as string)
  }
  return client
}

export default getSupabase
