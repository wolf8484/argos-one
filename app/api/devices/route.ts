import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { pairingCodeSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// Every registered device in the branches this login manages. Owners and
// admins only -- list_shop_devices filters by role itself (0060).
export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ devices: await repository.listDevices() })
  } catch (error) {
    return apiError(error, 'Could not load registered devices')
  }
}

// Issue a pairing code for a branch. Separate from branch creation because a
// tablet gets replaced, wiped, or added long after the branch itself exists.
export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { shopId } = pairingCodeSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ pairing: await repository.createPairingCode(shopId) })
  } catch (error) {
    return apiError(error, 'Could not create a pairing code')
  }
}
