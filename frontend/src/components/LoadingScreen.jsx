import { Leaf, LoaderCircle } from 'lucide-react'
import './loading-screen.css'

const toneStyles = {
  blue: {
    icon: 'text-blue-600',
    badge: 'bg-blue-50 ring-blue-100',
    text: 'text-slate-600',
  },
  green: {
    icon: 'text-green-600',
    badge: 'bg-green-50 ring-green-100',
    text: 'text-slate-600',
  },
}

export default function LoadingScreen({
  label = 'Loading...',
  fullScreen = false,
  compact = false,
  tone = 'green',
  className = '',
}) {
  const styles = toneStyles[tone] || toneStyles.green

  return (
    <div
      className={`${fullScreen ? 'min-h-screen bg-slate-50' : compact ? 'min-h-40' : 'min-h-[min(60vh,32rem)]'} grid w-full place-items-center px-6 py-10 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center text-center">
        <span className={`relative grid size-14 place-items-center rounded-full ring-1 ${styles.badge}`} aria-hidden="true">
          <LoaderCircle className={`ecoguard-loading-spinner absolute ${styles.icon}`} size={46} strokeWidth={1.8} />
          <Leaf className={styles.icon} size={18} strokeWidth={2.2} />
        </span>
        <p className={`mt-4 text-sm font-semibold ${styles.text}`}>{label}</p>
        <span className="sr-only">Please wait</span>
      </div>
    </div>
  )
}
