import { createClient } from '@supabase/supabase-js'
import { hasPasswordRecoveryEvidence } from '../utils/passwordValidation'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const hadPasswordRecoveryRedirect = typeof window !== 'undefined'
  && window.location.pathname === '/reset-password'
  && hasPasswordRecoveryEvidence(window.location.href)

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null
