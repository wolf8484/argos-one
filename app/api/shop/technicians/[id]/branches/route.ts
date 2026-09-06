import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { addTechnicianBranchSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// Every branch this person holds a place in -- the "Also works at" list on
// their staff detail.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ branches: await repository.listTechnicianBranches(id) })
  } catch (error) {
    return apiError(error, 'Could not load that staff member’s branches')
  }
}

// Grants an existing login a place in another branch of the same business --
// deliberately not a second invite, which would create a second account and
// split one person's history in two.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const input = addTechnicianBranchSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json(
      { placement: await repository.addTechnicianToBranch(id, input.shopId, input.role) },
      { status: 201 },
    )
  } catch (error) {
    return apiError(error, 'Could not add them to that branch')
  }
}
