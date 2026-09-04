import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile, listProfiles } from '../../services/profileService'
import { listAllTrips } from '../../services/tripService'
import {
  listCrowdThresholds,
  listEcologicalLocations,
  listLocationMetrics,
  subscribeToEnvironmentalIndicators,
} from '../../services/locationService'
import AdminDashboard from './AdminDashboard'
import AdminLayout from './AdminLayout'
import AdminProfile from './AdminProfile'
import ThresholdsHub from './ThresholdsHub'
import EcologicalLocations from './EcologicalLocations'
import EnvironmentalAnalytics from './EnvironmentalAnalytics'
import ReportsHub from './ReportsHub'
import WasteManagement from './WasteManagement'
import AdminApplications from './AdminApplications'
import SensorManagement from './SensorManagement'
import LocationDetailPage from '../location_admin/LocationDetailPage'
import { tripMatchesEcologicalLocation } from '../../utils/tripAnalytics'
import IncidentManagement from './IncidentManagement'
import AdvisoryManagement from './AdvisoryManagement'
import LoadingScreen from '../../components/LoadingScreen'

const adminPages = new Set([
  'dashboard', 'locations', 'location-detail', 'applications', 'sensors', 'incidents',
  'advisories', 'thresholds', 'waste', 'waste-overview', 'waste-schedules',
  'waste-history', 'analytics', 'reports', 'profile',
])

export default function AdminWorkspace({ requiredRole }) {
  const navigate = useNavigate()
  const { page: routePage } = useParams()
  const [workspaceSearchParams, setWorkspaceSearchParams] = useSearchParams()
  const routeBase = requiredRole === 'location_admin' ? '/location_admin' : '/super_admin'
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [trips, setTrips] = useState([])
  const [locations, setLocations] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [metrics, setMetrics] = useState([])
  const [selectedSensorLocationId, setSelectedSensorLocationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const reportTab = workspaceSearchParams.get('report') === 'waste' ? 'waste' : 'environment'
  const requestedPage = adminPages.has(routePage) ? routePage : 'dashboard'
  const page = profile?.role === 'location_admin' && ['locations', 'thresholds'].includes(requestedPage)
    ? 'location-detail'
    : requestedPage

  const refreshData = useCallback(async (scopeProfile) => {
    setDataLoading(true)
    setDataError('')

    try {
      const isSuper = scopeProfile?.role === 'super_admin'
      const isAdmin = ['location_admin', 'super_admin'].includes(scopeProfile?.role)
      const [profileRows, tripRows, locationRows, thresholdRows, metricRows] = await Promise.all([
        isSuper ? listProfiles() : Promise.resolve(scopeProfile ? [scopeProfile] : []),
        isAdmin ? listAllTrips() : Promise.resolve([]),
        listEcologicalLocations(),
        listCrowdThresholds(),
        listLocationMetrics(),
      ])
      const assignedLocationId = String(scopeProfile?.location_id || '')
      const assignedLocation = locationRows.find((item) => String(item.id) === assignedLocationId)
      const scopedTrips = isSuper
        ? tripRows
        : assignedLocation
          ? tripRows.filter((trip) => tripMatchesEcologicalLocation(trip, assignedLocation))
          : []
      setProfiles(profileRows)
      setTrips(scopedTrips)
      setLocations(isSuper ? locationRows : locationRows.filter((item) => String(item.id) === assignedLocationId))
      setThresholds(isSuper ? thresholdRows : thresholdRows.filter((item) => String(item.location_id) === assignedLocationId))
      setMetrics(isSuper ? metricRows : metricRows.filter((item) => String(item.location_id) === assignedLocationId))
    } catch (error) {
      setDataError(
        `${error.message || 'Unable to load admin data.'} Check that supabase/admin_location_scope.sql has been applied.`,
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

        if (!['super_admin', 'location_admin'].includes(currentProfile.role)) {
          navigate('/tourist/dashboard', { replace: true })
          return
        }

        if (currentProfile.role === 'location_admin' && !currentProfile.location_id) {
          throw new Error('This location administrator has no assigned location.')
        }

        if (requiredRole && currentProfile.role !== requiredRole) {
          navigate(currentProfile.role === 'super_admin' ? '/super_admin/dashboard' : '/location_admin/dashboard', { replace: true })
          return
        }

        setUser(sessionUser)
        setProfile(currentProfile)
        setLoading(false)
        await refreshData(currentProfile)
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
  }, [navigate, refreshData, requiredRole])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  function handleProfileChange(updatedProfile) {
    setProfile(updatedProfile)
    setProfiles((current) => current.map((item) => item.id === updatedProfile.id ? updatedProfile : item))
  }

  function handleNavigate(nextPage) {
    let destinationPage = adminPages.has(nextPage) ? nextPage : 'dashboard'
    let destinationSearch = ''
    if (nextPage === 'waste-analytics') {
      destinationPage = 'reports'
      destinationSearch = '?report=waste'
    }
    if (profile?.role === 'location_admin' && ['locations', 'thresholds'].includes(destinationPage)) {
      destinationPage = 'location-detail'
    }
    if (destinationPage !== page || destinationSearch) {
      navigate(`${routeBase}/${destinationPage}${destinationSearch}`)
    }
  }

  function handleReportTabChange(nextTab) {
    const nextParams = new URLSearchParams(workspaceSearchParams)
    if (nextTab === 'waste') nextParams.set('report', 'waste')
    else nextParams.delete('report')
    setWorkspaceSearchParams(nextParams)
  }

  useEffect(() => {
    if (page !== routePage) {
      navigate(`${routeBase}/${page}`, { replace: true })
    }
  }, [navigate, page, routeBase, routePage])

  const handleMetricCreated = useCallback((createdMetric) => {
    setMetrics((current) => [
      createdMetric,
      ...current.filter((item) => String(item.id) !== String(createdMetric.id)),
    ].slice(0, 500))
  }, [])

  useEffect(() => {
    if (!profile) return undefined

    return subscribeToEnvironmentalIndicators((updatedMetric) => {
      if (!updatedMetric?.id) return
      const canReadLocation = profile.role === 'super_admin'
        || String(updatedMetric.location_id) === String(profile.location_id)
      if (canReadLocation) handleMetricCreated(updatedMetric)
    })
  }, [handleMetricCreated, profile])

  if (loading) {
    return <main className="admin-theme"><LoadingScreen fullScreen tone="blue" label="Loading administrator workspace..." /></main>
  }

  if (accessError || !profile) {
    return (
      <main className="admin-theme grid min-h-screen place-items-center bg-slate-50 p-6">
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
    onDataChange: () => refreshData(profile),
    onMetricCreated: handleMetricCreated,
    user,
    profile,
    isSuperAdmin: profile.role === 'super_admin',
    selectedSensorLocationId,
    onSensorLocationChange: setSelectedSensorLocationId,
  }

  const wasteSections = {
    waste: 'schedules',
    'waste-overview': 'schedules',
    'waste-schedules': 'schedules',
    'waste-history': 'history',
  }
  const wasteSection = wasteSections[page]
  const pageContent = wasteSection ? (
    <WasteManagement
      {...sharedProps}
      section={wasteSection}
      onSectionChange={(nextSection) => handleNavigate(`waste-${nextSection}`)}
    />
  ) : ({
    dashboard: <AdminDashboard {...sharedProps} onNavigate={handleNavigate} />,
    locations: <EcologicalLocations {...sharedProps} />,
    'location-detail': <LocationDetailPage {...sharedProps} />,
    sensors: <SensorManagement {...sharedProps} />,
    incidents: <IncidentManagement {...sharedProps} />,
    advisories: <AdvisoryManagement {...sharedProps} />,
    thresholds: <ThresholdsHub {...sharedProps} />,
    analytics: <EnvironmentalAnalytics {...sharedProps} />,
    reports: <ReportsHub {...sharedProps} activeTab={reportTab} onTabChange={handleReportTabChange} />,
    applications: <AdminApplications />,
    profile: <AdminProfile user={user} profile={profile} onProfileChange={handleProfileChange} />,
  }[page])

  return (
    <AdminLayout activePage={page} onNavigate={handleNavigate} onLogout={handleLogout} user={user} profile={profile}>
      {dataLoading
        ? <LoadingScreen tone="blue" label="Loading administration data..." />
        : pageContent || <AdminDashboard {...sharedProps} onNavigate={handleNavigate} />}
    </AdminLayout>
  )
}
