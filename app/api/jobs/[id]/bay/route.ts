import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

type RouteContext = { params: Promise<{ id: string }> }

const baySchema = z.object({ bay: z.string().trim().min(1).nullable() })

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const { bay } = baySchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.reassignJobBay(id, bay) })
  } catch (error) {
    return apiError(error, 'Could not reassign bay')
  }
}
