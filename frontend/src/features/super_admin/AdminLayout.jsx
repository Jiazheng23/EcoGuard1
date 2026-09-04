import { useState } from 'react'
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Menu,
  Megaphone,
  RadioTower,
  Recycle,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  X,
} from 'lucide-react'
import AccountMenu from '../../components/AccountMenu'
import NotificationMenu from '../../components/NotificationMenu'
import './admin-theme.css'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
  { icon: MapPin, label: 'Locations', page: 'locations', superOnly: true },
  { icon: MapPin, label: 'Location Detail', page: 'location-detail', locationOnly: true },
  { icon: UserCheck, label: 'Applications', page: 'applications', superOnly: true },
  { icon: RadioTower, label: 'Sensors', page: 'sensors' },
  { icon: ShieldAlert, label: 'Incidents', page: 'incidents' },
  { icon: Megaphone, label: 'Advisories', page: 'advisories' },
  { icon: SlidersHorizontal, label: 'Thresholds', page: 'thresholds' },
  {
    icon: Recycle,
    label: 'Waste',
    page: 'waste',
    children: [
      { label: 'Collection Schedules', page: 'waste-schedules' },
      { label: 'Collection History', page: 'waste-history' },
    ],
  },
  { icon: Activity, label: 'Environmental Analytics', page: 'analytics' },
  { icon: BarChart2, label: 'Reports', page: 'reports' },
]

const pageLabels = {
  dashboard: 'Dashboard',
  locations: 'Ecological Locations',
  'location-detail': 'Location Detail',
  sensors: 'Sensor Monitoring',
  incidents: 'Environmental Incidents',
  advisories: 'Tourist Advisories',
  thresholds: 'Crowd Thresholds',
  waste: 'Waste Management',
  'waste-schedules': 'Waste / Collection Schedules',
  'waste-history': 'Waste / Collection History',
  analytics: 'Environmental Analytics',
  reports: 'Reports & Analytics',
  profile: 'Profile',
  applications: 'Location Admin Applications',
}

function getAdminDetails(user, profile) {
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'EcoGuard Admin'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EA'
  return { name, initials }
}

function AdminSidebar({ activePage, onNavigate, onClose, profile }) {
  const [wasteOpen, setWasteOpen] = useState(() => activePage.startsWith('waste'))
  const visibleItems = navItems.filter((item) => (
    (!item.superOnly || profile?.role === 'super_admin')
    && (!item.locationOnly || profile?.role === 'location_admin')
  ))

  function navigateTo(page) {
    onNavigate(page)
    onClose()
  }

  return (
    <div className="admin-sidebar flex h-full flex-col">
      <button type="button" onClick={() => navigateTo('dashboard')} className="admin-brand flex items-center gap-3 border-b px-5 py-5 text-left">
        <span className="admin-brand-mark grid size-9 place-items-center rounded-lg"><Shield size={17} className="text-white" /></span>
        <span><span className="block text-[15px] font-extrabold leading-none text-white">EcoGuard</span><span className="mt-1.5 block text-[9px] font-bold tracking-[0.18em] text-blue-200">{profile?.role === 'super_admin' ? 'SUPER ADMIN' : 'LOCATION ADMIN'}</span></span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Administrator navigation">
        {visibleItems.map(({ icon: Icon, label, page, children }) => {
          const active = activePage === page || (children && activePage.startsWith(`${page}-`))

          if (children) {
            const expanded = wasteOpen
            return (
              <div key={page}>
                <button
                  type="button"
                  onClick={() => setWasteOpen((current) => !current)}
                  aria-expanded={expanded}
                  className={`admin-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? 'is-active font-semibold' : ''}`}
                >
                  <Icon size={17} className="shrink-0" />
                  <span className="flex-1">{label}</span>
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {expanded && (
                  <div className="admin-subnav ml-5 mt-1 space-y-1 border-l pl-3">
                    {children.map((child) => {
                      const childActive = activePage === child.page || (activePage === page && child.page === `${page}-overview`)
                      return (
                        <button
                          key={child.page}
                          type="button"
                          onClick={() => navigateTo(child.page)}
                          aria-current={childActive ? 'page' : undefined}
                          className={`admin-nav-item w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${childActive ? 'is-active font-semibold' : ''}`}
                        >
                          {child.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <button key={page} type="button" onClick={() => navigateTo(page)} aria-current={active ? 'page' : undefined} className={`admin-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? 'is-active font-semibold' : ''}`}>
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
    <div className="admin-theme flex h-screen overflow-hidden">
      <aside className="admin-sidebar-shell hidden w-64 shrink-0 lg:block"><AdminSidebar {...sidebarProps} /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close administrator navigation" className="absolute inset-0 w-full bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
          <aside className="admin-sidebar-shell relative h-full w-64 shadow-xl">
            <button type="button" aria-label="Close administrator navigation" className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-50" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            <AdminSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="admin-header relative z-[1100] flex h-16 shrink-0 items-center gap-4 border-b px-4 md:px-7">
          <button type="button" aria-label="Open administrator navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <p className="min-w-0 flex-1 truncate text-sm"><span className="text-slate-400">{profile?.role === 'super_admin' ? 'Super Admin' : 'Location Admin'}&nbsp;&nbsp;/&nbsp;&nbsp;</span><strong className="text-slate-800">{pageLabels[activePage] || 'Dashboard'}</strong></p>
          <NotificationMenu role={profile?.role} userId={user?.id} onNavigate={onNavigate} accent="blue" />
          <AccountMenu name={name} email={user?.email} roleLabel={roleLabel} initials={initials} avatarUrl={profile?.avatar_url} accent="blue" onProfile={() => onNavigate('profile')} onLogout={onLogout} />
        </header>
        <main className="admin-main flex-1 overflow-y-auto p-4 md:p-7 xl:p-8">{children}</main>
      </div>
    </div>
  )
}
