import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

// Permanent, irreversible delete of a cancelled ("Deleted") job. Only ever
// reachable from the Deleted-inspection view's "Delete forever" action.
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    await repository.purgeJob(id)
    return NextResponse.json({ purged: true })
  } catch (error) {
    return apiError(error, 'Could not permanently delete job')
  }
}
