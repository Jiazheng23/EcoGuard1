import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { listEarlyWarningNotifications, markEarlyWarningsRead, subscribeToEarlyWarnings } from '../services/notificationService'
import { listActiveAdvisories, subscribeToAdvisories } from '../services/advisoryService'

const roleNotifications = {
  tourist: [
    { id: 'eco-status', title: 'Ecological status updates', detail: 'Review current crowd, warning, and environmental conditions.', page: 'monitoring' },
    { id: 'plan-trip', title: 'Plan a lower-carbon journey', detail: 'Calculate a route and review the recommended transport mode.', page: 'carbon' },
  ],
  location_admin: [
    { id: 'thresholds', title: 'Review crowd thresholds', detail: 'Confirm warning levels and automatic-alert settings for your location.', page: 'thresholds' },
    { id: 'waste', title: 'Waste records require regular updates', detail: 'Review collections, schedules, and the latest stored estimate.', page: 'waste' },
    { id: 'reports', title: 'Location reports are available', detail: 'Open your scoped environmental and waste reports.', page: 'reports' },
  ],
  super_admin: [
    { id: 'applications', title: 'Review administrator applications', detail: 'Check pending location-administrator access requests.', page: 'applications' },
    { id: 'locations', title: 'Monitor ecological locations', detail: 'Review managed destinations and their latest snapshots.', page: 'locations' },
    { id: 'reports', title: 'System reports are available', detail: 'Review trip and environmental information across locations.', page: 'reports' },
  ],
}

export default function NotificationMenu({ role = 'tourist', userId, onNavigate, accent = 'green' }) {
  const [open, setOpen] = useState(false)
  const storageKey = `ecoguard-notifications-read:${userId || role}`
  const [readIds, setReadIds] = useState(() => readStoredIds(storageKey))
  const [earlyWarnings, setEarlyWarnings] = useState([])
  const [advisories, setAdvisories] = useState([])
  const containerRef = useRef(null)
  const notifications = useMemo(() => [
    ...(role === 'tourist' ? advisories.map((advisory) => ({ id: `advisory-${advisory.id}`, title: advisory.title, detail: `${advisory.ecological_locations?.name || 'Destination'}: ${advisory.safety_instructions}`, page: 'monitoring', severity: 'warning' })) : []),
    ...earlyWarnings.map((alert) => ({
      id: `alert-${alert.id}`,
      alertId: alert.id,
      title: alert.title,
      detail: alert.detail,
      page: role === 'tourist' ? 'monitoring' : 'sensors',
      read: alert.read,
      severity: alert.severity,
    })),
    ...(roleNotifications[role] || roleNotifications.tourist),
  ], [advisories, earlyWarnings, role])
  const unreadCount = notifications.filter((item) => item.alertId ? !item.read : !readIds.includes(item.id)).length
  const accentClasses = accent === 'blue' ? 'hover:bg-blue-50 hover:text-blue-700' : 'hover:bg-green-50 hover:text-green-700'

  useEffect(() => {
    if (!open) return undefined
    function closeMenu(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && containerRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [open])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    const load = () => listEarlyWarningNotifications(userId)
      .then((items) => { if (active) setEarlyWarnings(items) })
      .catch(() => { if (active) setEarlyWarnings([]) })
    load()
    const unsubscribe = subscribeToEarlyWarnings(load)
    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  useEffect(() => {
    if (role !== 'tourist') return undefined
    let active = true
    const load = () => listActiveAdvisories().then((rows) => { if (active) setAdvisories(rows) }).catch(() => { if (active) setAdvisories([]) })
    void load()
    const unsubscribe = subscribeToAdvisories(load)
    return () => { active = false; unsubscribe() }
  }, [role])

  function storeReadIds(nextIds) {
    setReadIds(nextIds)
    window.localStorage.setItem(storageKey, JSON.stringify(nextIds))
  }

  async function openNotification(item) {
    if (item.alertId && !item.read) {
      await markEarlyWarningsRead(userId, [item.alertId])
      setEarlyWarnings((current) => current.map((alert) => alert.id === item.alertId ? { ...alert, read: true } : alert))
    } else if (!item.alertId && !readIds.includes(item.id)) storeReadIds([...readIds, item.id])
    setOpen(false)
    onNavigate?.(item.page)
  }

  async function markAllRead() {
    const unreadAlertIds = earlyWarnings.filter((alert) => !alert.read).map((alert) => alert.id)
    await markEarlyWarningsRead(userId, unreadAlertIds)
    setEarlyWarnings((current) => current.map((alert) => ({ ...alert, read: true })))
    storeReadIds([
      ...(roleNotifications[role] || roleNotifications.tourist).map((item) => item.id),
      ...advisories.map((item) => `advisory-${item.id}`),
    ])
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-label="Notifications" aria-haspopup="menu" aria-expanded={open} className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
        <Bell size={17} />
        {unreadCount > 0 && <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">{unreadCount}</span>}
      </button>

      {open && (
        <section role="menu" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div><h2 className="text-sm font-bold text-slate-800">Notifications</h2><p className="text-xs text-slate-400">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p></div>
            <button type="button" disabled={!unreadCount} onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 disabled:opacity-40"><CheckCheck size={14} /> Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {notifications.map((item) => {
              const unread = item.alertId ? !item.read : !readIds.includes(item.id)
              return <button key={item.id} type="button" role="menuitem" onClick={() => openNotification(item)} className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${accentClasses}`}><span className={`mt-1 size-2 shrink-0 rounded-full ${unread ? item.severity === 'critical' ? 'bg-red-600' : item.severity === 'warning' ? 'bg-orange-500' : 'bg-amber-400' : 'bg-slate-200'}`} /><span><b className="block text-sm text-slate-700">{item.title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span></span></button>
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function readStoredIds(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
