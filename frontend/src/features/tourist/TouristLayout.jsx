import { Award, Bell, Calculator, Clock3, LayoutDashboard, Leaf, Map, Menu, X } from 'lucide-react'
import { useState } from 'react'
import AccountMenu from '../../components/AccountMenu'

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
    <div className="flex h-full flex-col">
      <button type="button" onClick={() => navigateTo('dashboard')} className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5 text-left">
        <span className="grid size-8 place-items-center rounded-lg bg-green-500 text-white"><Leaf size={17} /></span>
        <span><span className="block font-bold leading-none text-slate-900">EcoGuard</span><span className="mt-1 block text-[9px] font-bold tracking-[0.15em] text-green-500">TOURIST MODE</span></span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Tourist navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => navigateTo(id)} aria-current={activePage === id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${activePage === id ? 'bg-green-50 font-semibold text-green-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white lg:block"><TouristSidebar {...sidebarProps} /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close tourist navigation" className="absolute inset-0 w-full bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative h-full w-60 bg-white shadow-xl">
            <button type="button" aria-label="Close tourist navigation" className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-50" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            <TouristSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-100 bg-white px-4 md:px-6">
          <button type="button" aria-label="Open tourist navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <p className="min-w-0 flex-1 truncate text-sm"><span className="text-slate-400">Tourist / </span><strong className="text-slate-700">{pageLabel}</strong></p>
          <button type="button" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50"><Bell size={17} /><span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-white" /></button>
          <AccountMenu name={name} email={user?.email} roleLabel="Tourist" initials={initials} accent="green" onProfile={() => onNavigate('profile')} onHistory={() => onNavigate('history')} onLogout={onLogout} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
