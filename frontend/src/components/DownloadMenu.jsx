import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'

export default function DownloadMenu({ items, disabled = false, loading = false, label = 'Download' }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function closeMenu(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [open])

  function selectItem(item) {
    setOpen(false)
    void item.onClick()
  }

  return (
    <div ref={menuRef} className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} disabled={disabled || loading} aria-haspopup="menu" aria-expanded={open} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
        <Download size={15} />{loading ? 'Preparing...' : label}<ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 min-w-48 overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
          {items.map((item) => <button key={item.label} type="button" role="menuitem" disabled={item.disabled} onClick={() => selectItem(item)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-green-50 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40">{item.label}</button>)}
        </div>
      )}
    </div>
  )
}
