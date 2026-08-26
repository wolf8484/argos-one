import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const query = request.nextUrl.searchParams.get('q') || ''
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const repairs = query.trim().length >= 3 ? await repository.searchShopRepairs(query) : []
    return NextResponse.json({ repairs })
  } catch (error) {
    return apiError(error, 'Could not search the repair library')
  }
}
