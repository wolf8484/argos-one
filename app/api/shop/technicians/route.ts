import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { normalizePhone } from '@/lib/server/identity'
import { inviteStaffSchema } from '@/lib/server/schemas'
import { WorkshopRepository } from '@/lib/server/workshop-repository'

export async function GET() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json({ technicians: await repository.listTechnicians() })
  } catch (error) {
    return apiError(error, 'Could not load technicians')
  }
}

// Adding staff is now always an invitation: the roster row and its code are
// created together, and the person becomes a real login only once they redeem
// it. A roster entry with no way to sign in cannot be assigned jobs, so there
// is no longer a reason to create one.
export async function POST(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = inviteStaffSchema.parse(await request.json())
    const mobile = input.mobile?.trim() ? normalizePhone(input.mobile) : null
    if (input.mobile?.trim() && !mobile) {
      return NextResponse.json({ error: "That mobile number doesn't look right. Use a format like 0412 345 678." }, { status: 400 })
    }
    const repository = new WorkshopRepository(auth.supabase, auth.profile)
    return NextResponse.json(await repository.inviteStaff({ ...input, mobile }), { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not invite that staff member')
  }
}
