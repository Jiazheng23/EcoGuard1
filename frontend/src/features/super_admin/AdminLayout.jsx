import { useState } from 'react'
import {
  BarChart2,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Recycle,
  Shield,
  SlidersHorizontal,
  User,
  UserCheck,
  X,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        page: 'dashboard',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        icon: MapPin,
        label: 'Ecological Locations',
        page: 'locations',
      },
      {
        icon: UserCheck,
        label: 'Admin Applications',
        page: 'applications',
        superOnly: true,
      },
      {
        icon: SlidersHorizontal,
        label: 'Crowd Thresholds',
        page: 'thresholds',
      },
      {
        icon: Recycle,
        label: 'Waste Management',
        page: 'waste',
      },
    ],
  },
  {
    label: 'Data & Monitoring',
    items: [
      {
        icon: BarChart2,
        label: 'Reports & Env. Data',
        page: 'reports',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        icon: User,
        label: 'Profile',
        page: 'profile',
      },
    ],
  },
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
  const name =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'EcoGuard Admin'

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EA'

  return { name, initials }
}

function AdminSidebar({ activePage, onNavigate, onLogout, onClose, user, profile }) {
  const { name, initials } = getAdminDetails(user, profile)

  function navigateTo(page) {
    onNavigate(page)
    onClose()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <Shield size={16} className="text-white" />
          </span>
          <div>
            <p className="font-extrabold leading-none text-slate-900">EcoGuard</p>
            <p className="mt-1 text-[10px] font-bold tracking-wider text-blue-500">
              {profile?.role === 'super_admin' ? 'SUPER ADMIN MODE' : 'LOCATION ADMIN MODE'}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigateTo('profile')}
        className="mx-4 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-bold text-white">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800">
              {name}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {profile?.role === 'super_admin' ? 'Super Administrator' : 'Location Administrator'}
            </span>
          </span>
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        </div>
      </button>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.hidden && (!item.superOnly || profile?.role === 'super_admin'))

          return (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(({ icon: Icon, label, page }) => {
                  const active = activePage === page

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => navigateTo(page)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                        active
                          ? 'bg-blue-50 font-semibold text-blue-500'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-slate-100 px-3 pb-4 pt-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-all hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({
  activePage,
  onNavigate,
  onLogout,
  user,
  profile,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { initials } = getAdminDetails(user, profile)

  const sidebarProps = {
    activePage,
    onNavigate,
    onLogout,
    user,
    profile,
    onClose: () => setSidebarOpen(false),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-white lg:flex">
        <AdminSidebar {...sidebarProps} />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            className="absolute inset-0 w-full bg-slate-950/30"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative h-full w-64 bg-white shadow-xl">
            <button
              type="button"
              aria-label="Close admin navigation"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
            <AdminSidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-100 bg-white px-4">
          <button
            type="button"
            aria-label="Open admin navigation"
            className="text-slate-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-slate-400">Admin / </span>
            <strong className="text-slate-700">
              {pageLabels[activePage] || 'Dashboard'}
            </strong>
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50"
            >
              <Bell size={16} />
              <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                5
              </span>
            </button>
            <button
              type="button"
              aria-label="Open administrator profile"
              onClick={() => onNavigate('profile')}
              className="ml-1 grid size-8 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white"
            >
              {initials}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
