import { createClient } from '@supabase/supabase-js'

// Service role — full access, only used server-side in API routes
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
