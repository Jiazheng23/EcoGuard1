import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import AdminDashboard from './AdminDashboard'
import AdminLayout from './AdminLayout'

const pageTitles = {
  locations: 'Ecological Locations',
  thresholds: 'Crowd Thresholds',
  waste: 'Waste Management',
  reports: 'Reports & Environmental Data',
  profile: 'Administrator Profile',
}

export default function AdminWorkspace() {
  const navigate = useNavigate()
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

      const role =
        sessionUser.app_metadata?.role ||
        sessionUser.user_metadata?.role ||
        'tourist'

      if (role !== 'admin') {
        navigate('/tourist/dashboard', { replace: true })
        return
      }

      setUser(sessionUser)
      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return

      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }

      setUser(session.user)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <p className="text-sm font-medium text-slate-500">
          Loading administrator workspace...
        </p>
      </main>
    )
  }

  return (
    <AdminLayout
      activePage={page}
      onNavigate={setPage}
      onLogout={handleLogout}
      user={user}
    >
      {page === 'dashboard' ? (
        <AdminDashboard onNavigate={setPage} />
      ) : (
        <PlaceholderPage title={pageTitles[page] || 'Admin Module'} />
      )}
    </AdminLayout>
  )
}

function PlaceholderPage({ title }) {
  return (
    <section className="mx-auto max-w-6xl rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-500">
        Coming next
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        This admin module will be connected after its Figma interface is added.
      </p>
    </section>
  )
}