import { createBrowserClient } from '@supabase/ssr'

import { publicEnv } from '@/lib/config/env'

let client: ReturnType<typeof createBrowserClient> | undefined

export function createBrowserSupabaseClient() {
  const env = publicEnv()
  client ??= createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return client
}
