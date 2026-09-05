import { useCallback, useMemo, useState } from 'react'
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

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info
          return (
            <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg ${styles[toast.type] || styles.info}`}>
              <Icon size={19} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="shrink-0 rounded-md p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"><X size={16} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
