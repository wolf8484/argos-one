import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id, noteId } = await params
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    await repository.deleteProfileNote(id, noteId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, 'Could not delete that note')
  }
}
