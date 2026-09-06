import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { businessSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function PATCH(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = businessSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ business: await repository.updateBusiness(input) })
  } catch (error) {
    return apiError(error, 'Could not save the business details')
  }
}
