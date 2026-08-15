import { supabase } from './supabaseClient'

export function profileFromUser(user) {
  if (!user) return null

  return {
    id: user.id,
    full_name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'EcoGuard User',
    phone: user.user_metadata?.phone || '',
    avatar_url: user.user_metadata?.avatar_url || null,
    role: user.app_metadata?.role === 'admin' ? 'admin' : 'tourist',
    eco_score: 50,
    total_carbon_saved: 0,
    current_streak: 0,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export async function getOwnProfile(user) {
  if (!user) throw new Error('You must be signed in to load a profile.')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error
  if (data) return data

  const fallback = profileFromUser(user)
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({
      id: fallback.id,
      full_name: fallback.full_name,
      phone: fallback.phone || null,
      avatar_url: fallback.avatar_url,
      role: 'tourist',
    })
    .select('*')
    .single()

  if (createError) {
    throw new Error(
      `Profile row is missing and could not be created: ${createError.message}`,
    )
  }

  return created
}

export async function updateOwnProfile(userId, values) {
  const payload = {
    full_name: values.fullName.trim(),
    phone: values.phone?.trim() || null,
    avatar_url: values.avatarUrl || null,
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, created_at, updated_at, phone, avatar_url, eco_score, total_carbon_saved, current_streak',
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}
