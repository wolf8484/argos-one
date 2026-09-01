import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

const assignSchema = z.object({ technicianId: z.string().uuid() })

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const { technicianId } = assignSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.reassignJob(id, technicianId) })
  } catch (error) {
    return apiError(error, 'Could not reassign job')
  }
}
