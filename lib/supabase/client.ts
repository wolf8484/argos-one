import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client. Safe to expose: the publishable key is protected by RLS.
export const supabase = createClient(supabaseUrl, supabaseKey)
