import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { createBranchSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// The branch directory, plus the business it belongs to. Returned together
// because the UI needs both to decide what to render: one branch means the
// switcher and the directory stay hidden entirely.
export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const [branches, business] = await Promise.all([
      repository.listBranches(),
      repository.getBusiness(),
    ])
    return NextResponse.json({
      branches,
      business,
      sessionPinned: repository.sessionPinned,
      device: repository.deviceContext,
    })
  } catch (error) {
    return apiError(error, 'Could not load branches')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = createBranchSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    const branch = await repository.createBranch(input) as { id: string }
    // A new branch is the one moment we know for certain a device there needs
    // setting up and the owner almost certainly is not standing next to it, so
    // the code comes back with the branch rather than making them go and ask
    // for one. Losing it is harmless -- they can issue another any time.
    const pairing = await repository.createPairingCode(branch.id).catch(() => null)
    return NextResponse.json({ branch, pairing }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not create that branch')
  }
}
