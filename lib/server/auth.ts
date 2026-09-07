import { NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Resolves which workshop this request is acting in, and refuses the request
 * if the caller has no active place in it.
 *
 * The branch comes from current_shop_id(), never from profiles.shop_id
 * directly. Since 0051 those are different things: profiles.shop_id is only
 * the home branch a session falls back to, while current_shop_id() applies
 * this session's own choice on top of it and re-checks the roster grant.
 * Reading the column here instead would put RLS in one branch and every
 * repository query in another -- which is exactly what happened when 0051
 * landed, and it signed people out mid-switch.
 */
export async function requireWorkshopUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }

  const [{ data: profile, error: profileError }, { data: shopId, error: shopError }] = await Promise.all([
    supabase.from('profiles').select('id, shop_id, full_name, role').eq('id', user.id).single(),
    supabase.rpc('current_shop_id'),
  ])

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Workshop profile is not configured' }, { status: 403 }) }
  }
  if (shopError) {
    return { error: NextResponse.json({ error: 'Could not verify workshop access' }, { status: 500 }) }
  }

  // current_shop_id() returns null for both "no branch at all" and "no active
  // grant in the branch you are pointed at". The profile's own column is what
  // separates them, and the two cases need different wording: one is somebody
  // who was removed from the business, the other is somebody switched off at a
  // branch they can be switched back on at.
  if (!shopId) {
    // Devices (0060) added a third way to land here, and it is not a
    // deactivation: signing in on a tablet registered to a branch this person
    // holds no roster row in. Telling them their access was revoked would send
    // them chasing a problem that does not exist -- they are simply standing in
    // the wrong workshop.
    const { data: device } = await supabase.rpc('device_context')
    const registeredShopId = (device as { registeredShopId?: string } | null)?.registeredShopId
    if (registeredShopId && registeredShopId !== profile.shop_id) {
      const branchName = (device as { registeredShopName?: string } | null)?.registeredShopName
      return {
        error: NextResponse.json(
          {
            error: branchName
              ? `This device is set up for ${branchName}. You're not assigned to that branch -- ask a manager to add you.`
              : "This device is set up for a branch you're not assigned to. Ask a manager to add you.",
            code: 'wrong_branch',
          },
          { status: 403 },
        ),
      }
    }
    const message = profile.shop_id
      ? 'Your access to this workshop has been deactivated. Contact your manager for more information.'
      : 'You are not a member of this workshop. Contact your manager for more information.'
    return { error: NextResponse.json({ error: message, code: 'no_workshop' }, { status: 403 }) }
  }

  // current_shop_id() already proved an active grant exists; this reads it back
  // for the role, which is per branch and so cannot come from profiles.role.
  const { data: membership, error: membershipError } = await supabase
    .from('shop_technicians')
    .select('id, role, active')
    .eq('profile_id', profile.id)
    .eq('shop_id', shopId)
    .eq('active', true)
    .maybeSingle()

  if (membershipError) {
    return { error: NextResponse.json({ error: 'Could not verify workshop access' }, { status: 500 }) }
  }
  if (!membership) {
    return {
      error: NextResponse.json(
        { error: 'Your access to this workshop has been deactivated. Contact your manager for more information.', code: 'no_workshop' },
        { status: 403 },
      ),
    }
  }

  // Everything downstream scopes itself with profile.shop_id and gates itself
  // on profile.role, so both are substituted here rather than at ~40 call
  // sites. role especially: profiles.role is one value for the whole login,
  // but authority is per branch -- an Owner at one site who is only a
  // Technician at another must not manage the roster there.
  return {
    supabase,
    user,
    profile: { ...profile, shop_id: shopId as string, role: membership.role as string },
    membership,
  }
}
