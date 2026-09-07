import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/config/env'
import { DEVICE_COOKIE, hashDeviceToken } from '@/lib/server/device'
import { apiError, ApiError } from '@/lib/server/http'
import { clientKey, enforceRateLimit } from '@/lib/server/rate-limit'
import { registerDeviceSchema } from '@/lib/server/schemas'

/**
 * Registering a workshop tablet to its branch, signed out.
 *
 * This is the only endpoint in the app with no login behind it, and it has to
 * be: a branch that has just been created may have no staff accounts at all,
 * so the hardware must be able to say what it is before any human
 * authenticates on it. What keeps that safe is that registration grants
 * nothing -- it names a branch, and current_shop_id() still refuses to show a
 * single job to anyone without an active roster row there.
 *
 * The anon client is built directly rather than through createServerSupabaseClient
 * because that one attaches the caller's session, and there is deliberately none.
 */
function anonClient() {
  const env = publicEnv()
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
}

async function deviceHash() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  return token ? hashDeviceToken(token) : null
}

// Whether this device is already set up, so the sign-in screen can hide the
// setup entry entirely. With no unpair flow yet, hiding it is what makes a
// registered tablet impossible to repoint by whoever happens to be holding it.
export async function GET() {
  try {
    const hash = await deviceHash()
    if (!hash) return NextResponse.json({ registered: false })
    const { data, error } = await anonClient().rpc('device_registration', { p_token_hash: hash })
    if (error) throw new ApiError(error.message, 400)
    return NextResponse.json(data)
  } catch (error) {
    return apiError(error, 'Could not check this device')
  }
}

export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(clientKey(request, 'device-pair'), { limit: 8, windowMs: 60_000 })
    const { code } = registerDeviceSchema.parse(await request.json())

    const hash = await deviceHash()
    if (!hash) throw new ApiError('This device could not be identified. Reload the page and try again.', 400)

    const { data, error } = await anonClient().rpc('register_device', {
      p_code: code,
      p_token_hash: hash,
    })
    if (error) throw new ApiError(error.message, 400)

    return NextResponse.json({ device: data })
  } catch (error) {
    return apiError(error, 'Could not set up this device')
  }
}
