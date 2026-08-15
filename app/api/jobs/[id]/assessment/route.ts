import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { assessmentSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'
import { summarizeAssessment } from '@/lib/server/assessment-summary'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await context.params
    const input = assessmentSchema.parse(await request.json())
    const summary = await summarizeAssessment(input.complaint, input.observations)
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ job: await repository.saveAssessment(id, { ...input, summary }) })
  } catch (error) {
    return apiError(error, 'Could not save assessment')
  }
}
