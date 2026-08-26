import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'

const shopSettingsSchema = z.object({
  sharesRepairData: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = shopSettingsSchema.parse(await request.json())
    const { data: shop, error } = await auth.supabase
      .from('shops')
      .update({ shares_repair_data: input.sharesRepairData })
      .eq('id', auth.profile.shop_id)
      .select('id,name,timezone,shares_repair_data,network_read_exempt')
      .single()
    if (error) throw error

    // Rebuild immediately either way: turning sharing on should surface this
    // shop's existing repair history right away rather than waiting for the
    // next resolved job, and turning it off should stop other shops from
    // seeing it immediately, not just from here on.
    const { error: refreshError } = await auth.supabase.rpc('refresh_network_contributions')
    if (refreshError) throw refreshError

    return NextResponse.json({ shop })
  } catch (error) {
    return apiError(error, 'Could not update shop settings')
  }
}
