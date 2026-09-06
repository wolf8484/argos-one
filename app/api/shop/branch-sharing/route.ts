import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { branchShareTargetSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// The per-branch switch list. Returns every sibling branch with whether this
// branch currently shares out to it, which is what the inline list under the
// "Share across branches" toggle renders.
export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ targets: await repository.listBranchShareTargets() })
  } catch (error) {
    return apiError(error, 'Could not load branch sharing')
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = branchShareTargetSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const targets = await repository.setBranchShareTarget(input.targetShopId, input.shared)
    return NextResponse.json({ targets })
  } catch (error) {
    return apiError(error, 'Could not update branch sharing')
  }
}
