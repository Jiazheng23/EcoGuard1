import { supabase } from './supabaseClient'

async function authorizedRequest(path, options = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication is required.')
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Application request failed.')
  return payload
}

export async function listAdminApplications() {
  const data = await authorizedRequest('/api/admin-applications')
  // The backend repairs legacy profiles whose trusted Auth claim is missing.
  // Refresh so browser-side Supabase RLS requests use the repaired claim.
  await supabase.auth.refreshSession()
  return data.applications || []
}

export async function decideAdminApplication(id, decision) {
  return authorizedRequest(`/api/admin-applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}
