import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'

/**
 * Whether this login still has a way into a workshop.
 *
 * An idle tab makes no requests, so a roster row going inactive -- or away --
 * stays invisible to it until someone touches something. It can already do
 * nothing (every other endpoint 403s the moment current_shop_id() stops
 * resolving), but it keeps showing numbers that are no longer theirs to see.
 * The shell polls this so that shell ends itself instead of lingering.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
