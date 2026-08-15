import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  const { data: shop } = await auth.supabase
    .from('shops')
    .select('id,name,timezone,currency')
    .eq('id', auth.profile.shop_id)
    .single()
  return NextResponse.json({ profile: auth.profile, shop })
}
