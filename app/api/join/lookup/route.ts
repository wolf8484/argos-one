import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/server/http'
import { lookupInvite } from '@/lib/server/join-workshop'
import { clientKey, enforceRateLimit } from '@/lib/server/rate-limit'
import { inviteLookupSchema } from '@/lib/server/schemas'

// Unauthenticated by design: the caller is a new staff member who has no
// account yet. The invite code is the only credential involved.
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(clientKey(request, 'invite-lookup'), { limit: 10, windowMs: 60_000 })
    const { code } = inviteLookupSchema.parse(await request.json())
    return NextResponse.json({ invite: await lookupInvite(code) })
  } catch (error) {
    return apiError(error, 'Could not check that code')
  }
}
