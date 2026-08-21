import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { profileNoteSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const input = profileNoteSchema.parse(await request.json())
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ note: await repository.addProfileNote(id, input) }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not save that note')
  }
}
