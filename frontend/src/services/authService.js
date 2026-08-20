import { supabase } from './supabaseClient'
import { getOwnProfile } from './profileService'

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw error

  const profile = await getOwnProfile(data.user)

  return { ...data, profile }
}

export async function registerUser({ name, email, password, role, locationId, companyDocument }) {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      locationId: role === 'location_admin' ? Number(locationId) : undefined,
      companyDocument: role === 'location_admin' ? companyDocument : undefined,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Registration failed.')
  return data
}

export async function sendPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/login`,
    },
  )

  if (error) throw error

  return data
}
