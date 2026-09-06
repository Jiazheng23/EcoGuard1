import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile } from '../../services/profileService'
import { authenticatedRequest } from '../../services/authenticatedRequest'
import { getApplicationSetup } from '../../services/locationAdminApplicationService'
import LoadingScreen from '../../components/LoadingScreen'
import './auth.css'
import './auth-overrides.css'

// Share initialization across StrictMode's effect replay to avoid duplicate profile writes.
let completion
function completeSignIn() {
  if (!completion) completion = (async () => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const error = url.searchParams.get('error') || hash.get('error')
    const wantsApplication = url.searchParams.get('application') === 'location_admin'
    const registrationRole = sessionStorage.getItem('ecoguard.googleRegistrationRole')
    sessionStorage.removeItem('ecoguard.googleRegistrationRole')
    try {
    if (error) {
      window.history.replaceState({}, '', '/auth/callback')
      throw new Error(error === 'access_denied' ? 'Google sign-in was cancelled. You can try again or sign in with email.' : 'Google sign-in failed. Please try again.')
    }
    if (!supabase) throw new Error('Authentication is unavailable. Supabase is not configured.')
    const { error: initError } = await supabase.auth.initialize()
    if (initError) throw initError
    const { data, error: userError } = await supabase.auth.getUser()
    window.history.replaceState({}, '', '/auth/callback')
    if (userError || !data.user) throw new Error('Your Google session could not be verified. Please sign in again.')
    if (wantsApplication) {
      await authenticatedRequest('/api/auth/google-application', { method: 'POST' })
    }
    const profile = await getOwnProfile(data.user)
    if (registrationRole === 'tourist' && profile.role !== 'tourist') {
      throw new Error('This email is already registered with another role. Sign in to your existing account or use a different Google email for Tourist.')
    }
    if (profile.role === 'super_admin') return { path: '/super_admin/dashboard' }
    if (profile.role === 'location_admin') return { path: '/location_admin/dashboard' }
    if (profile.role === 'pending_location_admin') {
      const applicationSetup = await getApplicationSetup()
      return { path: applicationSetup.applicationStatus === 'pending' ? '/location_admin/pending' : '/location_admin/application', state: { applicationSetup } }
    }
    return { path: '/tourist/dashboard' }
    } catch (failure) {
      return {
        path: registrationRole || wantsApplication ? '/register' : '/login',
        state: {
          authError: failure.message || 'Google sign-in failed. Please try again.',
          registrationRole: wantsApplication ? 'location_admin' : registrationRole,
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
    completeSignIn().then(({ path, state }) => {
      if (active) navigate(path, { replace: true, state })
    }).catch((failure) => {
      if (active) navigate('/login', { replace: true, state: { authError: failure.message || 'Google sign-in failed. Please try again.' } })
    })
    return () => { active = false }
  }, [navigate])
  return <LoadingScreen fullScreen label="Completing your Google sign-in..." />
}
