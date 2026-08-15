import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { createJobSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ jobs: await repository.listJobs() })
  } catch (error) {
    return apiError(error, 'Could not load jobs')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = createJobSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const job = await repository.createJob(input)
    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not create job')
  }
}
