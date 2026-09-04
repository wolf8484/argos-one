import { isEmailIdentifier, normalizePhone, staffAuthEmail } from '@/lib/identity'
import { ApiError } from '@/lib/server/http'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Turns whatever someone typed into the "Email or mobile" field into the email
 * their Supabase login is actually keyed on.
 *
 * Needed because a staff account's auth email is not always derivable from the
 * identifier: someone who joined with a mobile *and* an email is keyed on the
 * real email, so computing staffAuthEmail() from their number would miss them
 * and they would be locked out of the very field that invites them to use it.
 *
 * A number with no matching profile returns the placeholder form rather than an
 * error, so a stranger probing numbers gets the same "wrong password" answer
 * either way instead of a signal about who has an account.
 */
export async function resolveIdentifier(identifier: string) {
  const trimmed = identifier.trim()
  if (!trimmed) throw new ApiError('Enter your email or mobile number.', 400)
  if (isEmailIdentifier(trimmed)) return trimmed

  const phone = normalizePhone(trimmed)
  if (!phone) throw new ApiError("That doesn't look like an email or a mobile number.", 400)

  const admin = createAdminSupabaseClient()
  const { data: profile } = await admin
    .from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (!profile) return staffAuthEmail(phone)

  const { data } = await admin.auth.admin.getUserById(profile.id)
  return data?.user?.email || staffAuthEmail(phone)
}
