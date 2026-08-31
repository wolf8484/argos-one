import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { shopSettingsSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function PATCH(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = shopSettingsSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const shop = await repository.updateShop(input)

    // Rebuild immediately either way: turning sharing on should surface this
    // shop's existing repair history right away rather than waiting for the
    // next resolved job, and turning it off should stop other shops from
    // seeing it immediately, not just from here on.
    if (input.sharesRepairData !== undefined) {
      const { error: refreshError } = await auth.supabase.rpc('refresh_network_contributions')
      if (refreshError) throw refreshError
    }

    return NextResponse.json({ shop })
  } catch (error) {
    return apiError(error, 'Could not update shop settings')
  }
}
