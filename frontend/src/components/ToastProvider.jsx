import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BellRing, CheckCircle2, Info, X } from 'lucide-react'
import { ToastContext } from './toastContext'

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  reminder: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  reminder: BellRing,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const pageRef = useRef(null)
  const blocked = toasts.length > 0

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', duration = 4500) => {
    if (!message) return
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, type }].slice(-4))
    window.setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const value = useMemo(() => ({
    show,
    success: (message) => show(message, 'success'),
    error: (message) => show(message, 'error', 6000),
    reminder: (message) => show(message, 'reminder'),
    info: (message) => show(message, 'info'),
  }), [show])

  useEffect(() => {
    const page = pageRef.current
    if (!blocked || !page) return undefined

    const previousOverflow = document.body.style.overflow
    page.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'

    function dismissLatest(event) {
      if (event.key === 'Escape') setToasts((current) => current.slice(0, -1))
    }

    document.addEventListener('keydown', dismissLatest)
    return () => {
      page.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', dismissLatest)
    }
  }, [blocked])

  return (
    <ToastContext.Provider value={value}>
      <div ref={pageRef} aria-hidden={blocked ? 'true' : undefined}>
        {children}
      </div>
      {blocked && <div className="fixed inset-0 z-[9999] cursor-default bg-slate-950/20 backdrop-blur-[2px]" aria-hidden="true" onMouseDown={(event) => event.preventDefault()} onClick={(event) => event.preventDefault()} />}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" role={blocked ? 'dialog' : undefined} aria-modal={blocked ? 'true' : undefined} aria-label={blocked ? 'System notification' : undefined} aria-live="polite" aria-atomic="false">
        {toasts.map((toast, index) => {
          const Icon = icons[toast.type] || Info
          return (
            <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg ${styles[toast.type] || styles.info}`}>
              <Icon size={19} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
              <button type="button" autoFocus={index === toasts.length - 1} onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="shrink-0 rounded-md p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/30"><X size={16} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
