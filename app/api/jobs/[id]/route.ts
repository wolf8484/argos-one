import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { createJobSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.getJob(id) })
  } catch (error) {
    return apiError(error, 'Could not load job')
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const input = createJobSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.updateJobDetails(id, input) })
  } catch (error) {
    return apiError(error, 'Could not update job details')
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.archiveJob(id), deleted: true })
  } catch (error) {
    return apiError(error, 'Could not delete job')
  }
}
