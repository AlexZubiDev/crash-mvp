import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS.
// Use only in privileged routes (cron tick, round management).
// Never expose to the browser.
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
