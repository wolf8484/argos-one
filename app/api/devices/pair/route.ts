import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { publicEnv } from '@/lib/config/env'
import { createClient } from '@supabase/supabase-js'
import { DEVICE_COOKIE, hashDeviceToken } from '@/lib/server/device'
import { apiError, ApiError } from '@/lib/server/http'
import { clientKey, enforceRateLimit } from '@/lib/server/rate-limit'
import { redeemPairingSchema } from '@/lib/server/schemas'

/**
 * Registering a workshop tablet to its branch, signed out.
 *
 * This is the only endpoint in the app with no login behind it, and it has to
 * be: a branch that has just been created may have no staff accounts at all,
 * so the hardware must be able to say what it is before any human authenticates
 * on it. What keeps that safe is that registration grants nothing -- it names a
 * branch, and current_shop_id() still refuses to show a single job to anyone
 * without an active roster row there.
 *
 * The anon client is built directly rather than through createServerSupabaseClient
 * because that one attaches the caller's session, and there is deliberately
 * none here.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(clientKey(request, 'device-pair'), { limit: 8, windowMs: 60_000 })
    const { code, label } = redeemPairingSchema.parse(await request.json())

    const token = (await cookies()).get(DEVICE_COOKIE)?.value
    if (!token) throw new ApiError('This device could not be identified. Reload the page and try again.', 400)

    const env = publicEnv()
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const { data, error } = await supabase.rpc('redeem_pairing_code', {
      p_code: code,
      p_token_hash: hashDeviceToken(token),
      p_label: label ?? null,
    })
    if (error) throw new ApiError(error.message, 400)

    return NextResponse.json({ device: data })
  } catch (error) {
    return apiError(error, 'Could not set up this device')
  }
}
