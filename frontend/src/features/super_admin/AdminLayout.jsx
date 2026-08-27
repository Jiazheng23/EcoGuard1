import { useState } from 'react'
import {
  BarChart2,
  LayoutDashboard,
  MapPin,
  Menu,
  Recycle,
  Shield,
  SlidersHorizontal,
  UserCheck,
  X,
} from 'lucide-react'
import AccountMenu from '../../components/AccountMenu'
import NotificationMenu from '../../components/NotificationMenu'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
  { icon: MapPin, label: 'Locations', page: 'locations' },
  { icon: UserCheck, label: 'Applications', page: 'applications', superOnly: true },
  { icon: SlidersHorizontal, label: 'Thresholds', page: 'thresholds' },
  { icon: Recycle, label: 'Waste', page: 'waste' },
  { icon: BarChart2, label: 'Reports', page: 'reports' },
]

const pageLabels = {
  dashboard: 'Dashboard',
  locations: 'Ecological Locations',
  thresholds: 'Crowd Thresholds',
  waste: 'Waste Management',
  reports: 'Reports & Environmental Data',
  profile: 'Profile',
  applications: 'Location Admin Applications',
}

function getAdminDetails(user, profile) {
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'EcoGuard Admin'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EA'
  return { name, initials }
}

function AdminSidebar({ activePage, onNavigate, onClose, profile }) {
  const visibleItems = navItems.filter((item) => !item.superOnly || profile?.role === 'super_admin')

  function navigateTo(page) {
    onNavigate(page)
    onClose()
  }

  return (
    <div className="flex h-full flex-col">
      <button type="button" onClick={() => navigateTo('dashboard')} className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5 text-left">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500"><Shield size={16} className="text-white" /></span>
        <span><span className="block font-extrabold leading-none text-slate-900">EcoGuard</span><span className="mt-1 block text-[9px] font-bold tracking-[0.15em] text-blue-500">{profile?.role === 'super_admin' ? 'SUPER ADMIN' : 'LOCATION ADMIN'}</span></span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Administrator navigation">
        {visibleItems.map(({ icon: Icon, label, page }) => {
          const active = activePage === page
          return (
            <button key={page} type="button" onClick={() => navigateTo(page)} aria-current={active ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-blue-50 font-semibold text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Icon size={17} className="shrink-0" />{label}
            </button>
          )
        })}
      </nav>

    </div>
  )
}

export default function AdminLayout({ activePage, onNavigate, onLogout, user, profile, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { name, initials } = getAdminDetails(user, profile)
  const roleLabel = profile?.role === 'super_admin' ? 'Super Administrator' : 'Location Administrator'
  const sidebarProps = {
    activePage,
    onNavigate,
    profile,
    onClose: () => setSidebarOpen(false),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white lg:block"><AdminSidebar {...sidebarProps} /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close administrator navigation" className="absolute inset-0 w-full bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative h-full w-60 bg-white shadow-xl">
            <button type="button" aria-label="Close administrator navigation" className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-50" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            <AdminSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-100 bg-white px-4 md:px-6">
          <button type="button" aria-label="Open administrator navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <p className="min-w-0 flex-1 truncate text-sm"><span className="text-slate-400">{profile?.role === 'super_admin' ? 'Super Admin' : 'Local Admin'} / </span><strong className="text-slate-700">{pageLabels[activePage] || 'Dashboard'}</strong></p>
          <NotificationMenu role={profile?.role} userId={user?.id} onNavigate={onNavigate} accent="blue" />
          <AccountMenu name={name} email={user?.email} roleLabel={roleLabel} initials={initials} avatarUrl={profile?.avatar_url} accent="blue" onProfile={() => onNavigate('profile')} onLogout={onLogout} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
