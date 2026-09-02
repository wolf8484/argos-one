import { createClient } from '@supabase/supabase-js'

import { serverEnv } from '@/lib/config/env'
import { ApiError } from '@/lib/server/http'

/**
 * Service-role client. Bypasses RLS entirely and can create auth users, so it
 * must never be constructed anywhere a browser bundle can reach -- only inside
 * route handlers.
 *
 * Redeeming an invite is the one flow that needs it: the caller has no session
 * yet (that is the point), and creating the login through the browser would
 * make Supabase demand an email/SMS confirmation round-trip. Creating it here
 * pre-confirmed is safe because the invite code is itself the proof that a
 * workshop owner vouched for this person.
 */
export function createAdminSupabaseClient() {
  const env = serverEnv()
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError('Account creation is not configured on this server.', 503)
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
