import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock3, FileCheck2, Leaf, LoaderCircle, LogOut, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { getOwnProfile } from '../../services/profileService'
import { getApplicationSetup } from '../../services/locationAdminApplicationService'
import './location-admin-application.css'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Checking your application...')
  const [rejected, setRejected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)

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
        setRejectionReason(application.rejectionReason || '')
        setStatus('Review the feedback below, update your application, and submit it again.')
      } else {
        setStatus('Your company document and location are awaiting review by a super administrator.')
      }
    }).catch((error) => setStatus(error.message)).finally(() => setLoading(false))
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return <main className="admin-theme location-application-page pending-application-page">
    <div className="location-application-orb location-application-orb--one" aria-hidden="true" />
    <div className="location-application-orb location-application-orb--two" aria-hidden="true" />
    <section className="location-application-shell pending-application-shell">
      <header className="location-application-intro">
        <div className="location-application-brand"><span><Leaf size={19} /></span> EcoGuard EEWS</div>
        <div><p className="location-application-kicker">Location administrator onboarding</p><h2>Protect the place you know best.</h2><p>One verified administrator per EcoGuard location.</p></div>
      </header>

      <div className="pending-application-content">
        <button type="button" onClick={logout} className="location-application-signout pending-application-signout"><LogOut size={15} /> <span>Sign out</span></button>
        {loading ? <div className="pending-application-loading"><LoaderCircle className="animate-spin" size={28} /><p>{status}</p></div> : <>
          <div className={`pending-status-icon ${rejected ? 'pending-status-icon--rejected' : ''}`}>
            {rejected ? <ShieldCheck size={32} /> : <Clock3 size={32} />}
          </div>
          <p className={`pending-status-kicker ${rejected ? 'pending-status-kicker--rejected' : ''}`}>{rejected ? 'Action required' : 'Application submitted'}</p>
          <h1>{rejected ? 'Your application needs an update' : 'Your application is under review'}</h1>
          <p className="pending-status-copy">{status}</p>

          {rejected ? <div className="pending-rejection-reason">
            <div><FileCheck2 size={18} /><strong>Reason for rejection</strong></div>
            <p>{rejectionReason || 'No reason was provided for this earlier application.'}</p>
          </div> : <div className="pending-review-progress" aria-label="Application progress">
            <div className="is-complete"><span><Check size={15} /></span><div><strong>Application received</strong><small>Your information was submitted successfully.</small></div></div>
            <div className="is-current"><span><Clock3 size={15} /></span><div><strong>Super-admin review</strong><small>Your location and document are being verified.</small></div></div>
            <div><span><ShieldCheck size={15} /></span><div><strong>Workspace access</strong><small>You can sign in after approval.</small></div></div>
          </div>}

          <div className="pending-application-actions">
            {rejected && <button type="button" onClick={() => navigate('/location_admin/application')} className="pending-primary-action"><RotateCcw size={16} /> Update and resubmit</button>}
            {!rejected && <p><ShieldCheck size={14} /> You can safely sign out while the review is in progress.</p>}
          </div>
        </>}
      </div>
    </section>
  </main>
}
