import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.restoreJob(id) })
  } catch (error) {
    return apiError(error, 'Could not restore job')
  }
}
