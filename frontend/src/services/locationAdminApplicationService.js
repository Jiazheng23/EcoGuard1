import { supabase } from './supabaseClient'

async function authorizedRequest(path, options = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication is required.')
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Application request failed.')
  return payload
}

export function getApplicationSetup() {
  return authorizedRequest('/api/location-admin/unassigned-locations')
}

export function submitLocationAdminApplication(values) {
  return authorizedRequest('/api/location-admin/application', {
    method: 'POST',
    body: JSON.stringify(values),
  })
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read the company document.'))
    reader.readAsDataURL(file)
  })
}
