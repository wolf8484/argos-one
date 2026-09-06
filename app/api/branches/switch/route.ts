import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { switchBranchSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// Switching is per-session, so this changes what THIS device sees and leaves
// the same login on another device alone -- see set_session_branch (0050).
export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { shopId } = switchBranchSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ branch: await repository.switchBranch(shopId) })
  } catch (error) {
    return apiError(error, 'Could not switch branch')
  }
}
