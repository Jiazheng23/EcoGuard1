import { Award, Calculator, Clock3, LayoutDashboard, Leaf, Map, Menu, X } from 'lucide-react'
import { useState } from 'react'
import AccountMenu from '../../components/AccountMenu'
import NotificationMenu from '../../components/NotificationMenu'
import './tourist-theme.css'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'carbon', label: 'Carbon Calculator', icon: Calculator },
  { id: 'history', label: 'Trip History', icon: Clock3 },
  { id: 'achievements', label: 'Achievement Badges', icon: Award },
  { id: 'monitoring', label: 'Eco Monitoring', icon: Map },
]

function getTouristDetails(user, profile) {
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Tourist'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('') || 'T'
  return { name, initials }
}

function TouristSidebar({ activePage, onNavigate, onClose }) {
  function navigateTo(page) {
    onNavigate(page)
    onClose()
  }

  return (
    <div className="tourist-sidebar flex h-full flex-col">
      <button type="button" onClick={() => navigateTo('dashboard')} className="tourist-brand flex items-center gap-3 border-b px-5 py-6 text-left">
        <span className="tourist-brand-mark grid size-10 place-items-center rounded-full text-white"><Leaf size={19} /></span>
        <span><span className="block text-lg font-bold leading-none">EcoGuard</span><span className="mt-1.5 block text-[9px] font-bold tracking-[0.22em]">EXPLORE RESPONSIBLY</span></span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Tourist navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => navigateTo(id)} aria-current={activePage === id ? 'page' : undefined} className={`tourist-nav-item flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors ${activePage === id ? 'is-active font-semibold' : ''}`}>
            <Icon size={17} />{label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function TouristLayout({ activePage, onNavigate, user, profile, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { name, initials } = getTouristDetails(user, profile)
  const accountPageLabels = { profile: 'Profile', history: 'Trip History' }
  const pageLabel = accountPageLabels[activePage] || navItems.find((item) => item.id === activePage)?.label || 'Dashboard'
  const sidebarProps = {
    activePage,
    onNavigate,
    onClose: () => setSidebarOpen(false),
  }

  return (
    <div className="tourist-app flex h-screen overflow-hidden">
      <aside className="tourist-sidebar-shell hidden w-64 shrink-0 lg:block"><TouristSidebar {...sidebarProps} /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close tourist navigation" className="absolute inset-0 w-full bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
          <aside className="tourist-sidebar-shell relative h-full w-72 max-w-[86vw] shadow-xl">
            <button type="button" aria-label="Close tourist navigation" className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-50" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            <TouristSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="tourist-header relative z-[1100] flex h-16 shrink-0 items-center gap-4 px-4 md:px-7">
          <button type="button" aria-label="Open tourist navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <p className="min-w-0 flex-1 truncate text-sm"><span className="tourist-breadcrumb">Explore / </span><strong>{pageLabel}</strong></p>
          <NotificationMenu role="tourist" userId={user?.id} onNavigate={onNavigate} accent="green" />
          <AccountMenu name={name} email={user?.email} roleLabel="Tourist" initials={initials} avatarUrl={profile?.avatar_url} accent="green" onProfile={() => onNavigate('profile')} onHistory={() => onNavigate('history')} onLogout={onLogout} />
        </header>
        <main className="tourist-main flex-1 overflow-y-auto p-4 md:p-7">{children}</main>
      </div>
    </div>
  )
}
