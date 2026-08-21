import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { resolveProfileSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ profiles: await repository.listVehicleProfiles() })
  } catch (error) {
    return apiError(error, 'Could not load the repair library')
  }
}

// Find-or-create, so a mechanic can open a profile for a car the shop has not
// serviced yet instead of waiting for one to come through the door.
export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = resolveProfileSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const profileId = await repository.resolveVehicleProfile(input)
    if (!profileId) return NextResponse.json({ error: 'Could not resolve a car profile' }, { status: 400 })
    return NextResponse.json({ profileId }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not open that car profile')
  }
}
