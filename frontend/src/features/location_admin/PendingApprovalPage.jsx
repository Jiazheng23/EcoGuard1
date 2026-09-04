import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, LogOut, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile } from '../../services/profileService'
import { getApplicationSetup } from '../../services/locationAdminApplicationService'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Checking your application...')
  const [rejected, setRejected] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return navigate('/login', { replace: true })
      const profile = await getOwnProfile(data.session.user)
      if (profile.role === 'super_admin') return navigate('/super_admin/dashboard', { replace: true })
      if (profile.role === 'location_admin') return navigate('/location_admin/dashboard', { replace: true })
      if (profile.role === 'tourist') return navigate('/tourist/dashboard', { replace: true })
      const application = await getApplicationSetup()
      if (!application.hasApplication) return navigate('/location_admin/application', { replace: true })
      if (application.applicationStatus === 'rejected') {
        setRejected(true)
        setStatus('Your application was rejected. You can update your location and document, then submit it again.')
      } else setStatus('Your company document is awaiting review by a super administrator.')
    }).catch((error) => setStatus(error.message))
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return <main className="admin-theme grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm"><ShieldCheck className={`mx-auto ${rejected ? 'text-amber-500' : 'text-blue-500'}`} size={42} /><h1 className="mt-4 text-xl font-bold text-slate-900">Location admin application</h1><p className="mt-3 text-sm leading-6 text-slate-500"><Clock3 className="mr-1 inline" size={15} />{status}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{rejected && <button type="button" onClick={() => navigate('/location_admin/application')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"><RotateCcw size={16} /> Update and resubmit</button>}<button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"><LogOut size={16} /> Sign out</button></div></section></main>
}
