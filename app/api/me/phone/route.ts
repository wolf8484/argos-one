import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { normalizePhone } from '@/lib/server/identity'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Attaches a mobile to the caller's profile as a display/contact field. This
 * is not a login method -- the account still signs in with its real email --
 * so it only ever needs a plain row update, never Supabase's native phone
 * field (which would require a paid SMS provider to be configured). Scope is
 * deliberately narrow: it only ever touches auth.uid(), never an id supplied
 * by the request.
 */
export async function PATCH(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { phone } = await request.json()
    const normalized = typeof phone === 'string' && phone.trim() ? normalizePhone(phone) : null
    if (!normalized) {
      return NextResponse.json({ error: "That mobile number doesn't look right." }, { status: 400 })
    }
    const admin = createAdminSupabaseClient()
    const { error: profileError } = await admin.from('profiles').update({ phone: normalized }).eq('id', auth.user.id)
    if (profileError) throw profileError
    return NextResponse.json({ phone: normalized })
  } catch (error) {
    return apiError(error, 'Could not save that mobile number')
  }
}
