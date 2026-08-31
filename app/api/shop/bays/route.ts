import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { baySchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ bays: await repository.listBays() })
  } catch (error) {
    return apiError(error, 'Could not load bays')
  }
}

export async function POST(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = baySchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ bay: await repository.addBay(input) })
  } catch (error) {
    return apiError(error, 'Could not add that bay')
  }
}
