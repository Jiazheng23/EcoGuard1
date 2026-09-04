import { Leaf } from 'lucide-react'
import LoadingScreen from '../../components/LoadingScreen'
import './location-admin-application.css'

export default function LocationAdminCheckingPage() {
  return <main className="admin-theme location-application-page">
    <div className="location-application-orb location-application-orb--one" aria-hidden="true" />
    <div className="location-application-orb location-application-orb--two" aria-hidden="true" />
    <section className="location-application-shell">
      <header className="location-application-intro">
        <div className="location-application-brand"><span><Leaf size={19} /></span> EcoGuard EEWS</div>
        <div><p className="location-application-kicker">Location administrator onboarding</p><h2>Protect the place you know best.</h2><p>One verified administrator per EcoGuard location.</p></div>
      </header>
      <div className="location-application-card">
        <div className="location-application-checking">
          <LoadingScreen compact tone="green" label="Checking application status..." />
        </div>
      </div>
    </section>
  </main>
}
