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
    return NextResponse.json({ branches, business, sessionPinned: repository.sessionPinned })
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
    return NextResponse.json({ branch: await repository.createBranch(input) }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not create that branch')
  }
}
