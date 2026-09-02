import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

/** Regenerates the code for a staff member who lost theirs or let it expire. */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ invite: await repository.issueInvite(id) })
  } catch (error) {
    return apiError(error, 'Could not generate a new invite code')
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    await repository.revokeInvite(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, 'Could not revoke that invite')
  }
}
