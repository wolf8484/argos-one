import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { updateProfileNoteSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id, noteId } = await params
    const input = updateProfileNoteSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ note: await repository.updateProfileNote(id, noteId, input.body) })
  } catch (error) {
    return apiError(error, 'Could not save that note')
  }
}

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
