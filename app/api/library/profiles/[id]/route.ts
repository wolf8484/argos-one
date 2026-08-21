import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json(await repository.getVehicleProfile(id))
  } catch (error) {
    return apiError(error, 'Could not load that car profile')
  }
}
