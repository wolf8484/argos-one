import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

// Unregistering hardware. The device keeps its cookie but stops answering for
// a branch, so whoever signs in on it next falls back to their home branch
// rather than being silently pointed at a workshop it no longer belongs to.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    await repository.revokeDevice(id)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return apiError(error, 'Could not remove that device')
  }
}
