import { NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * The API's half of the membership gate that migration 0048 put into
 * current_shop_id(). RLS already stops a removed or deactivated staff member
 * reading any shop data, but on its own that reads as an app full of empty
 * lists rather than "you no longer have access" -- and a route that never
 * touches a shop-scoped table would otherwise still answer them. Checking the
 * roster row here turns both into one clear 403 the client can act on.
 */
export async function requireWorkshopUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, shop_id, full_name, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Workshop profile is not configured' }, { status: 403 }) }
  }

  // Cleared by 0048 when someone is removed from a roster: the login survives,
  // but it is not pointed at any workshop until an invite is redeemed.
  if (!profile.shop_id) {
    return {
      error: NextResponse.json(
        { error: 'You are not a member of this workshop. Contact your manager for more information.', code: 'no_workshop' },
        { status: 403 },
      ),
    }
  }

  // Deactivated staff keep their shop_id (they can be switched back on), so
  // membership has to be checked rather than inferred from the profile.
  const { data: membership, error: membershipError } = await supabase
    .from('shop_technicians')
    .select('id, role, active')
    .eq('profile_id', profile.id)
    .eq('shop_id', profile.shop_id)
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

  return { supabase, user, profile, membership }
}
