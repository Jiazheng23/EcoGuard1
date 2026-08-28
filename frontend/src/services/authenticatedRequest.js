import { supabase } from './supabaseClient'

const SESSION_REFRESH_BUFFER_SECONDS = 30
let refreshInFlight = null

export async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session?.access_token) {
          throw new Error('Your login session has expired. Please sign in again.')
        }
        return data.session.access_token
      })
      .finally(() => {
        refreshInFlight = null
      })
  }

  return refreshInFlight
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error('Authentication is required. Please sign in again.')
  }

  const expiresAt = Number(data.session.expires_at || 0)
  const expiresSoon = expiresAt > 0
    && expiresAt <= Math.floor(Date.now() / 1000) + SESSION_REFRESH_BUFFER_SECONDS

  return expiresSoon ? refreshAccessToken() : data.session.access_token
}

async function sendRequest(path, options, token) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

export async function authenticatedRequest(path, options = {}) {
  let token = await getAccessToken()
  let response = await sendRequest(path, options, token)

  if (response.status === 401) {
    token = await refreshAccessToken()
    response = await sendRequest(path, options, token)
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'The authenticated request failed.')
  }

  return payload
}
