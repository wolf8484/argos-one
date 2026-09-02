import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/server/http'
import { redeemInvite } from '@/lib/server/join-workshop'
import { clientKey, enforceRateLimit } from '@/lib/server/rate-limit'
import { joinWorkshopSchema } from '@/lib/server/schemas'

// Unauthenticated by design -- see the lookup route. Creates the login and
// attaches it to the inviting workshop, then leaves the caller to sign in
// normally; no session is issued here.
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(clientKey(request, 'invite-join'), { limit: 5, windowMs: 60_000 })
    const input = joinWorkshopSchema.parse(await request.json())
    return NextResponse.json(await redeemInvite(input), { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not create your account')
  }
}
