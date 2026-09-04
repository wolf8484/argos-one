import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/server/http'
import { clientKey, enforceRateLimit } from '@/lib/server/rate-limit'
import { resolveIdentifier } from '@/lib/server/resolve-identifier'

// Unauthenticated by design: this runs *before* sign-in, to work out which
// email the typed identifier belongs to. It never confirms whether an account
// exists -- an unknown mobile gets a synthesised address back and fails at the
// password step like any wrong credential.
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(clientKey(request, 'identifier-resolve'), { limit: 20, windowMs: 60_000 })
    const { identifier } = await request.json()
    if (typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Enter your email or mobile number.' }, { status: 400 })
    }
    return NextResponse.json({ email: await resolveIdentifier(identifier) })
  } catch (error) {
    return apiError(error, 'Could not check those details')
  }
}
