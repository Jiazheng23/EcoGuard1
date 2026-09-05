import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  ChevronRight,
  Leaf,
  MapPinned,
  Menu,
  Radar,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './landing.css'

const features = [
  { icon: Calculator, title: 'Measure your impact', text: 'Calculate trip emissions and understand how every transport choice affects your footprint.', tone: 'mint' },
  { icon: MapPinned, title: 'Explore responsibly', text: 'View ecological conditions and make better-informed choices before visiting a destination.', tone: 'teal' },
  { icon: BarChart3, title: 'See your progress', text: 'Turn every recorded trip into clear trends, an eco score, and actionable insights.', tone: 'lime' },
]

const steps = [
  ['01', 'Create your profile', 'Join as a tourist or location administrator.'],
  ['02', 'Record & monitor', 'Log trips and explore environmental conditions.'],
  ['03', 'Make a difference', 'Use real insights to choose lower-impact travel.'],
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.14 },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="EcoGuard home">
          <span><Leaf size={19} /></span>
          <div>EcoGuard <small>EEWS</small></div>
        </a>
        <nav className={menuOpen ? 'is-open' : ''} aria-label="Main navigation">
          <a href="#purpose" onClick={() => setMenuOpen(false)}>Why EcoGuard</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <Link className="nav-signin" to="/login">Sign in</Link>
          <Link className="nav-join" to="/register">Get started <ArrowRight size={15} /></Link>
        </nav>
        <button className="menu-toggle" type="button" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <section className="landing-hero" id="top">
        <div className="hero-orb hero-orb--one" />
        <div className="hero-orb hero-orb--two" />
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Smarter tourism. Healthier ecosystems.</div>
          <h1>Travel with purpose.<br /><em>Protect what matters.</em></h1>
          <p>EcoGuard is Malaysia’s ecological early warning and sustainable travel platform—helping tourists understand their impact and communities protect the places they call home.</p>
          <div className="hero-actions">
            <Link className="primary-cta" to="/register">Start your eco journey <ArrowRight size={18} /></Link>
            <a className="secondary-cta" href="#purpose">See how it works <ChevronRight size={17} /></a>
          </div>
          <div className="hero-trust"><span><Check size={13} /></span> Built for conscious travellers and destination teams</div>
        </div>

        <div className="eco-visual" aria-label="Animated EcoGuard monitoring preview">
          <div className="orbit orbit--outer"><i /><i /><i /></div>
          <div className="orbit orbit--inner" />
          <div className="eco-globe">
            <div className="globe-grid" />
            <Leaf size={70} strokeWidth={1.25} />
            <span>LIVE ECO<br />INSIGHTS</span>
          </div>
          <div className="float-card float-card--score">
            <span className="card-icon"><Leaf size={17} /></span><div><small>Eco score</small><b>86 <i>Excellent</i></b></div>
          </div>
          <div className="float-card float-card--alert">
            <span className="pulse-dot" /><div><small>Monitoring status</small><b>Conditions stable</b></div>
          </div>
          <div className="float-card float-card--carbon">
            <small>Carbon saved</small><b>12.4 kg</b><span>CO₂ this month</span>
          </div>
        </div>
      </section>

      <section className="purpose-section" id="purpose" data-reveal>
        <div className="section-kicker">ONE PLATFORM, SHARED PURPOSE</div>
        <h2>Small choices create <span>lasting change.</span></h2>
        <p className="section-intro">EcoGuard connects personal travel decisions with the health of the destinations we love—making sustainability visible, practical, and rewarding.</p>
        <div className="impact-strip">
          <div><strong>Track</strong><span>Your travel footprint</span></div>
          <i />
          <div><strong>Understand</strong><span>Local eco conditions</span></div>
          <i />
          <div><strong>Improve</strong><span>Every journey you take</span></div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading" data-reveal>
          <div><span className="section-kicker">BUILT FOR BETTER TRAVEL</span><h2>Awareness that leads to action.</h2></div>
          <p>Simple tools turn complex environmental data into choices you can use before, during, and after every trip.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text, tone }, index) => (
            <article className={`feature-card feature-card--${tone}`} key={title} data-reveal style={{ '--delay': `${index * 90}ms` }}>
              <span className="feature-number">0{index + 1}</span>
              <div className="feature-icon"><Icon size={25} /></div>
              <h3>{title}</h3><p>{text}</p>
              <Link to="/register">Explore the feature <ArrowRight size={15} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-visual" data-reveal>
          <div className="radar-shell"><Radar size={76} /><span /><span /><span /></div>
          <div className="mini-panel"><ShieldCheck size={22} /><div><b>Early warning system</b><small>Data that helps destinations respond sooner.</small></div></div>
        </div>
        <div className="how-copy" data-reveal>
          <span className="section-kicker">HOW IT WORKS</span>
          <h2>From insight to impact,<br />one journey at a time.</h2>
          <div className="steps">
            {steps.map(([number, title, text]) => <div className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}
          </div>
        </div>
      </section>

      <section className="final-cta" data-reveal>
        <div><span className="section-kicker">YOUR NEXT JOURNEY STARTS HERE</span><h2>Ready to travel lighter?</h2><p>Join EcoGuard and make every destination better because you visited.</p></div>
        <Link to="/register">Create free account <ArrowRight size={18} /></Link>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top"><span><Leaf size={19} /></span><div>EcoGuard <small>EEWS</small></div></a>
        <p>Ecological Early Warning System for sustainable tourism.</p>
        <span>© {new Date().getFullYear()} EcoGuard</span>
      </footer>
    </main>
  )
}
