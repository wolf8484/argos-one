import { NextResponse } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

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

  return { supabase, user, profile }
}
