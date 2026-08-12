import {
  Bell,
  Calculator,
  FileText,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map,
  Menu,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'carbon',
    label: 'Carbon Calculator',
    icon: Calculator,
  },
  {
    id: 'monitoring',
    label: 'Eco Monitoring',
    icon: Map,
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: UserRound,
  },
]

export default function TouristLayout({ activePage, onNavigate, user, onLogout, children }) {
  const fullName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Tourist";

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

  const [menuOpen, setMenuOpen] = useState(false);
  const pageLabel =
    navItems.find((item) => item.id === activePage)?.label ?? "Dashboard";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-green-500 text-white">
            <Leaf size={17} />
          </span>
          <div>
            <p className="font-bold text-slate-900">EcoGuard</p>
            <p className="text-[10px] font-bold tracking-wider text-green-500">
              TOURIST MODE
            </p>
          </div>
        </div>
      </div>
      <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-700 text-sm font-bold text-white">
            {initials}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {fullName}
            </p>

            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              onNavigate(id);
              setMenuOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${activePage === id ? "bg-green-50 font-semibold text-green-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-500"
        >
          <LogOut size={17} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white lg:block">
        {sidebar}
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 w-full bg-slate-950/30"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-64 bg-white shadow-xl">
            <button
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 p-2 text-slate-400"
              onClick={() => setMenuOpen(false)}
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-100 bg-white px-4">
          <button
            className="text-slate-500 lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <p className="flex-1 text-sm">
            <span className="text-slate-400">Tourist / </span>
            <b className="text-slate-700">{pageLabel}</b>
          </p>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-50">
            <Search size={17} />
          </button>
          <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50">
            <Bell size={17} />
            <i className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
          </button>
          <span
            title={fullName}
            className="grid size-8 place-items-center rounded-full bg-green-500 text-xs font-bold text-white"
          >
            {initials}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
