import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

// Backwards-compatible export for the existing catalog helpers.
export const supabase = createBrowserSupabaseClient()
