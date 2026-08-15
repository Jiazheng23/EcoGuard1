import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile, listProfiles } from '../../services/profileService'
import { listAllTrips } from '../../services/tripService'
import {
  listCrowdThresholds,
  listEcologicalLocations,
  listLocationMetrics,
} from '../../services/locationService'
import AdminDashboard from './AdminDashboard'
import AdminLayout from './AdminLayout'
import AdminProfile from './AdminProfile'
import CrowdThresholds from './CrowdThresholds'
import EcologicalLocations from './EcologicalLocations'
import Reports from './Reports'
import WasteManagement from './WasteManagement'

export default function AdminWorkspace() {
  const navigate = useNavigate()
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [trips, setTrips] = useState([])
  const [locations, setLocations] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  const refreshData = useCallback(async () => {
    setDataLoading(true)
    setDataError('')

    try {
      const [profileRows, tripRows, locationRows, thresholdRows, metricRows] = await Promise.all([
        listProfiles(),
        listAllTrips(),
        listEcologicalLocations(),
        listCrowdThresholds(),
        listLocationMetrics(),
      ])
      setProfiles(profileRows)
      setTrips(tripRows)
      setLocations(locationRows)
      setThresholds(thresholdRows)
      setMetrics(metricRows)
    } catch (error) {
      setDataError(
        `${error.message || 'Unable to load admin data.'} Check that both SQL setup files in the supabase folder have been applied.`,
      )
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user || null

      if (!active) return
      if (!sessionUser) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const currentProfile = await getOwnProfile(sessionUser)
        if (!active) return

        if (currentProfile.role !== 'admin') {
          navigate('/tourist/dashboard', { replace: true })
          return
        }

        setUser(sessionUser)
        setProfile(currentProfile)
        setLoading(false)
        await refreshData()
      } catch (error) {
        if (!active) return
        setAccessError(
          `${error.message || 'Unable to load administrator profile.'} Administrator access could not be verified.`,
        )
        setLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (!session?.user) navigate('/login', { replace: true })
      else setUser(session.user)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate, refreshData])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  function handleProfileChange(updatedProfile) {
    setProfile(updatedProfile)
    setProfiles((current) => current.map((item) => item.id === updatedProfile.id ? updatedProfile : item))
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50"><p className="text-sm font-medium text-slate-500">Loading administrator workspace...</p></main>
  }

  if (accessError || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="max-w-lg rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Administrator access unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-red-600">{accessError || 'No administrator profile was found.'}</p>
          <button type="button" onClick={() => navigate('/login', { replace: true })} className="mt-5 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white">Return to sign in</button>
        </section>
      </main>
    )
  }

  const sharedProps = {
    profiles,
    trips,
    locations,
    thresholds,
    metrics,
    loading: dataLoading,
    error: dataError,
    onDataChange: refreshData,
    user,
  }

  const pageContent = {
    dashboard: <AdminDashboard {...sharedProps} onNavigate={setPage} />,
    locations: <EcologicalLocations {...sharedProps} />,
    thresholds: <CrowdThresholds {...sharedProps} />,
    waste: <WasteManagement {...sharedProps} />,
    reports: <Reports {...sharedProps} />,
    profile: <AdminProfile user={user} profile={profile} onProfileChange={handleProfileChange} />,
  }[page]

  return (
    <AdminLayout activePage={page} onNavigate={setPage} onLogout={handleLogout} user={user} profile={profile}>
      {pageContent || <AdminDashboard {...sharedProps} onNavigate={setPage} />}
    </AdminLayout>
  )
}
