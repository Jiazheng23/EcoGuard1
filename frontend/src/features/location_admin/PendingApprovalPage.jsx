import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile } from '../../services/profileService'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Checking your application...')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return navigate('/login', { replace: true })
      const profile = await getOwnProfile(data.session.user)
      if (profile.role === 'super_admin') return navigate('/super_admin/dashboard', { replace: true })
      if (profile.role === 'location_admin') return navigate('/location_admin/dashboard', { replace: true })
      if (profile.role === 'tourist') setStatus('Your application was not approved. Your account has tourist access.')
      else setStatus('Your company document is awaiting review by a super administrator.')
    }).catch((error) => setStatus(error.message))
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto text-blue-500" size={42} /><h1 className="mt-4 text-xl font-bold text-slate-900">Location admin application</h1><p className="mt-3 text-sm leading-6 text-slate-500"><Clock3 className="mr-1 inline" size={15} />{status}</p><button type="button" onClick={logout} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"><LogOut size={16} /> Sign out</button></section></main>
}
