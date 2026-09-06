import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile } from '../../services/profileService'
import { authenticatedRequest } from '../../services/authenticatedRequest'
import { getApplicationSetup } from '../../services/locationAdminApplicationService'
import LoadingScreen from '../../components/LoadingScreen'
import './auth.css'
import './auth-overrides.css'

async function getExistingProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

async function destinationFor(profile) {
  if (profile.role === 'super_admin') return { path: '/super_admin/dashboard' }
  if (profile.role === 'location_admin') return { path: '/location_admin/dashboard' }
  if (profile.role === 'pending_location_admin') {
    const applicationSetup = await getApplicationSetup()
    return {
      path: applicationSetup.applicationStatus === 'pending' ? '/location_admin/pending' : '/location_admin/application',
      state: { applicationSetup },
    }
  }
  return { path: '/tourist/dashboard' }
}

// Share callback initialization across StrictMode's effect replay.
let completion
function inspectGoogleSignIn() {
  if (!completion) completion = (async () => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const oauthError = url.searchParams.get('error') || hash.get('error')
    const wantsApplication = url.searchParams.get('application') === 'location_admin'
    const registrationRole = sessionStorage.getItem('ecoguard.googleRegistrationRole')
    sessionStorage.removeItem('ecoguard.googleRegistrationRole')
    sessionStorage.removeItem('ecoguard.googleOAuthStartedAt')
    try {
      if (oauthError) {
        throw new Error(oauthError === 'access_denied'
          ? 'Google sign-in was cancelled. You can try again or sign in with email.'
          : 'Google sign-in failed. Please try again.')
      }
      if (!supabase) throw new Error('Authentication is unavailable. Supabase is not configured.')
      const { error: initError } = await supabase.auth.initialize()
      if (initError) throw initError
      const { data, error: userError } = await supabase.auth.getUser()
      window.history.replaceState({}, '', '/auth/callback')
      if (userError || !data.user) throw new Error('Your Google session could not be verified. Please sign in again.')

      const profile = await getExistingProfile(data.user.id)
      const createdAt = Date.parse(data.user.created_at || '')
      const lastSignInAt = Date.parse(data.user.last_sign_in_at || '')
      const isFirstGoogleSignIn = Number.isFinite(createdAt)
        && Number.isFinite(lastSignInAt)
        && Math.abs(lastSignInAt - createdAt) <= 60_000
      if (wantsApplication) {
        await authenticatedRequest('/api/auth/google-application', { method: 'POST' })
        return { destination: await destinationFor(await getExistingProfile(data.user.id)) }
      }
      if (registrationRole === 'tourist') {
        if (profile && profile.role !== 'tourist') {
          throw new Error('This email is already registered with another role. Sign in to your existing account or use a different Google email for Tourist.')
        }
        return { destination: await destinationFor(profile || await getOwnProfile(data.user)) }
      }

      if (!profile || isFirstGoogleSignIn) return { needsRole: true, user: data.user }
      return { destination: await destinationFor(profile) }
    } catch (failure) {
      return {
        destination: {
          path: registrationRole || wantsApplication ? '/register' : '/login',
          state: {
            authError: failure.message || 'Google sign-in failed. Please try again.',
            registrationRole: wantsApplication ? 'location_admin' : registrationRole,
          },
        },
      }
    }
  })()
  return completion
}

export default function GoogleCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    inspectGoogleSignIn().then(({ destination, needsRole }) => {
      if (!active) return
      if (needsRole) navigate('/login', { replace: true, state: { googleRoleSelection: true } })
      else navigate(destination.path, { replace: true, state: destination.state })
    }).catch((failure) => {
      if (active) navigate('/login', { replace: true, state: { authError: failure.message || 'Google sign-in failed. Please try again.' } })
    })
    return () => { active = false }
  }, [navigate])
  return <LoadingScreen fullScreen label="Completing your Google sign-in..." />
}
