import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { technicianSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ technicians: await repository.listTechnicians() })
  } catch (error) {
    return apiError(error, 'Could not load technicians')
  }
}

export async function POST(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = technicianSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ technician: await repository.addTechnician(input) })
  } catch (error) {
    return apiError(error, 'Could not add that technician')
  }
}
