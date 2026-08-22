import { useEffect, useRef, useState } from 'react'
import { ChevronDown, History, LogOut, UserRound } from 'lucide-react'

const themes = {
  blue: {
    avatar: 'from-blue-500 to-indigo-500',
    button: 'border-blue-100 hover:border-blue-200 hover:bg-blue-50',
    badge: 'bg-blue-50 text-blue-700',
    profile: 'text-blue-600 hover:bg-blue-50',
  },
  green: {
    avatar: 'from-green-400 to-green-700',
    button: 'border-green-100 hover:border-green-200 hover:bg-green-50',
    badge: 'bg-green-50 text-green-700',
    profile: 'text-green-700 hover:bg-green-50',
  },
}

export default function AccountMenu({ name, email, roleLabel, initials, accent = 'blue', onProfile, onHistory, onLogout }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const theme = themes[accent] || themes.blue

  useEffect(() => {
    function closeWhenOutside(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeWhenOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function openProfile() {
    setOpen(false)
    onProfile()
  }

  function openHistory() {
    setOpen(false)
    onHistory?.()
  }

  function logOut() {
    setOpen(false)
    onLogout()
  }

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" aria-label="Open account menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex items-center gap-1 rounded-full border bg-white p-1 pr-2 transition ${theme.button}`}>
        <span className={`grid size-8 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${theme.avatar}`}>{initials}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl" role="menu">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${theme.avatar}`}>{initials}</span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{name}</p><p className="truncate text-xs text-slate-400">{email}</p></div>
            </div>
            <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${theme.badge}`}>{roleLabel}</span>
          </div>

          <div className="p-2">
            <button type="button" role="menuitem" onClick={openProfile} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${theme.profile}`}><UserRound size={17} />Profile</button>
            {onHistory && <button type="button" role="menuitem" onClick={openHistory} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${theme.profile}`}><History size={17} />History</button>}
            <button type="button" role="menuitem" onClick={logOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"><LogOut size={17} />Log out</button>
          </div>
        </div>
      )}
    </div>
  )
}
