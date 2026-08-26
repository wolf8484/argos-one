import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { data: shop, error } = await auth.supabase
      .from('shops')
      .select('id,name,timezone,shares_repair_data,network_read_exempt')
      .eq('id', auth.profile.shop_id)
      .single()
    if (error) throw error
    return NextResponse.json({ profile: auth.profile, shop })
  } catch (error) {
    return apiError(error, 'Could not load account')
  }
}
