import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { updateBranchSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const input = updateBranchSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ branch: await repository.updateBranch(id, input) })
  } catch (error) {
    return apiError(error, 'Could not save that branch')
  }
}
