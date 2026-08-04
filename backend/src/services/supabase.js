import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

export { supabase }