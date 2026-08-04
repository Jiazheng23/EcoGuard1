import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import TouristDashboard from './TouristDashboard'
import TouristLayout from './TouristLayout'
import WasteInformation from './WasteInformation'
import EcologicalMonitoring from './EcologicalMonitoring'
import CarbonCalculator from './CarbonCalculator'

export default function TouristWorkspace() {
  const navigate = useNavigate()
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: loggedInUser },
        error,
      } = await supabase.auth.getUser()

      if (error || !loggedInUser) {
        navigate('/login', { replace: true })
        return
      }

      setUser(loggedInUser)
      setLoading(false)
    }

    loadUser()
  }, [navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading your account...
        </p>
      </div>
    )
  }

  return (
    <TouristLayout
      activePage={page}
      onNavigate={setPage}
      user={user}
      onLogout={handleLogout}
    >
      {page === 'dashboard' ? (
        <TouristDashboard
          onNavigate={setPage}
          user={user}
        />
      ) : page === 'carbon' ? (
        <CarbonCalculator />
      ) : page === 'waste' ? (
        <WasteInformation />
      ) : page === 'monitoring' ? (
        <EcologicalMonitoring onNavigate={setPage} />
      ) : (
        <section className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-600">
            Coming next
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {page.replace(/^./, (letter) => letter.toUpperCase())} module
          </h1>

          <p className="mt-2 text-slate-500">
            This screen will be added after the Tourist Dashboard.
          </p>
        </section>
      )}
    </TouristLayout>
  )
}