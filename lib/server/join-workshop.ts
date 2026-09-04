import type { SupabaseClient } from '@supabase/supabase-js'

import { ApiError } from '@/lib/server/http'
import { staffAuthEmail } from '@/lib/identity'
import { normalizeInviteCode, normalizePhone } from '@/lib/server/identity'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

type InviteRow = {
  id: string
  shop_id: string
  technician_id: string
  code: string
  email: string | null
  mobile: string | null
  expires_at: string
  consumed_at: string | null
  shop: { name: string } | { name: string }[] | null
  technician: { first_name: string; last_name: string | null; role: string; profile_id: string | null }
    | { first_name: string; last_name: string | null; role: string; profile_id: string | null }[]
    | null
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

/**
 * Resolves a code to its invite, rejecting anything a caller should not be
 * able to act on. Deliberately returns the same generic message for "no such
 * code" so a probe cannot distinguish a wrong guess from a real code that
 * happens to be spent.
 */
async function resolveInvite(admin: SupabaseClient, rawCode: string) {
  const code = normalizeInviteCode(rawCode)
  if (!code) throw new ApiError("That invite code isn't valid.", 400)

  const { data, error } = await admin
    .from('shop_invites')
    .select(`id,shop_id,technician_id,code,email,mobile,expires_at,consumed_at,
      shop:shops(name),
      technician:shop_technicians(first_name,last_name,role,profile_id)`)
    .eq('code', code)
    .maybeSingle()
  if (error) throw error

  const invite = data as InviteRow | null
  if (!invite) throw new ApiError("That invite code isn't valid.", 400)
  if (invite.consumed_at) throw new ApiError('This code has already been used.', 409)
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new ApiError('This code has expired — ask your admin for a new one.', 410)
  }
  return invite
}

/** Read-only check used by the "enter your code" step, before any account exists. */
export async function lookupInvite(rawCode: string) {
  const admin = createAdminSupabaseClient()
  const invite = await resolveInvite(admin, rawCode)
  const technician = one(invite.technician)
  return {
    shopName: one(invite.shop)?.name ?? 'this workshop',
    firstName: technician?.first_name ?? '',
    lastName: technician?.last_name ?? '',
    role: technician?.role ?? 'technician',
    email: invite.email ?? '',
    mobile: invite.mobile ?? '',
  }
}

/**
 * Redeems a code: creates a pre-confirmed login and attaches it to the
 * inviting shop's existing roster row. Pre-confirmed is safe here because the
 * code is proof the owner vouched for this person, and it means no SMS or
 * email round-trip is needed to get an older mechanic onto the tablet.
 */
export async function redeemInvite(input: {
  code: string
  firstName: string
  lastName: string
  email?: string | null
  mobile?: string | null
  password: string
}) {
  const admin = createAdminSupabaseClient()
  const invite = await resolveInvite(admin, input.code)
  const technician = one(invite.technician)
  if (!technician) throw new ApiError('This invite is no longer valid.', 409)
  if (technician.profile_id) throw new ApiError('This code has already been used.', 409)

  const email = input.email?.trim() || null
  const phone = input.mobile?.trim() ? normalizePhone(input.mobile) : null
  if (!phone) {
    throw new ApiError("That mobile number doesn't look right. Use a format like 0412 345 678.", 400)
  }

  // The mobile is a sign-in identifier, so a second account cannot claim one
  // that is already in use -- /api/auth/resolve maps a typed number to exactly
  // one login, and a duplicate would make that mapping ambiguous.
  const { data: phoneTaken } = await admin
    .from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (phoneTaken) {
    throw new ApiError('An account already uses that mobile number. Sign in instead.', 409)
  }

  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()
  // Auth always keys off an email -- a real one if they gave us one, otherwise
  // a placeholder derived from their phone (see staffAuthEmail). This sidesteps
  // Supabase's native phone-auth path entirely, which requires a paid SMS
  // provider to be configured project-wide just to allow password sign-in.
  const authEmail = email ?? staffAuthEmail(phone!)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    password: input.password,
    // join_invite tells handle_new_user to stand down: this signup must attach
    // to the inviting shop, not spawn a new one with this person as its owner.
    user_metadata: { full_name: fullName, join_invite: invite.code },
  })
  if (createError) {
    const alreadyExists = /already|registered|exists/i.test(createError.message)
    throw new ApiError(
      alreadyExists
        ? 'An account already uses that email or mobile. Sign in instead.'
        : createError.message,
      alreadyExists ? 409 : 400,
    )
  }

  const userId = created.user.id
  // Past this point the auth user exists but is not usable until it has a
  // profile, so any failure below has to take the login back out with it.
  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      shop_id: invite.shop_id,
      full_name: fullName,
      role: technician.role,
      phone,
    })
    if (profileError) throw profileError

    const { error: linkError } = await admin
      .from('shop_technicians')
      .update({ profile_id: userId, first_name: input.firstName.trim(), last_name: input.lastName.trim() })
      .eq('id', invite.technician_id)
      .is('profile_id', null)
    if (linkError) throw linkError

    const { error: consumeError } = await admin
      .from('shop_invites')
      .update({ consumed_at: new Date().toISOString(), consumed_by: userId })
      .eq('id', invite.id)
      .is('consumed_at', null)
    if (consumeError) throw consumeError
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw error
  }

  return { shopName: one(invite.shop)?.name ?? 'your workshop' }
}
