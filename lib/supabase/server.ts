import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { publicEnv } from '@/lib/config/env'
import { DEVICE_COOKIE, deviceHeaders } from '@/lib/server/device'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const env = publicEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    // Every request carries which device it came from, hashed. current_shop_id()
    // reads it out of request.headers to decide the branch before falling back
    // to the home branch -- see 0060. A request without the cookie sends no
    // header and resolves exactly the way it did before devices existed.
    global: { headers: deviceHeaders(cookieStore.get(DEVICE_COOKIE)?.value) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot set cookies. Route handlers and proxy can.
        }
      },
    },
  })
}
