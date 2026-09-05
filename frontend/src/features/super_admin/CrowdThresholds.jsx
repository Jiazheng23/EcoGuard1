import { useMemo, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, Bell, CheckCircle, MapPin, Save, Search } from 'lucide-react'
import { latestMetricsByLocation, saveCrowdThreshold } from '../../services/locationService'
import { useToast } from '../../components/toastContext'

const levelStyles = {
  optimal: { label: 'Optimal', color: '#22c55e', background: '#f0fdf4' },
  caution: { label: 'Caution', color: '#f59e0b', background: '#fffbeb' },
  warning: { label: 'Warning', color: '#f97316', background: '#fff7ed' },
  critical: { label: 'Critical', color: '#ef4444', background: '#fef2f2' },
}

const defaultThreshold = (locationId) => ({
  location_id: locationId,
  caution_percent: 60,
  warning_percent: 80,
  critical_percent: 90,
  auto_alerts: true,
  notification_email: '',
})

function statusFor(occupancy, threshold) {
  if (occupancy >= threshold.critical_percent) return 'critical'
  if (occupancy >= threshold.warning_percent) return 'warning'
  if (occupancy >= threshold.caution_percent) return 'caution'
  return 'optimal'
}

export default function CrowdThresholds({ user, locations, thresholds, metrics, loading, error, onDataChange, embedded = false, showFilters = true, showSummary = true }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fieldErrors, setFieldErrors] = useState({})
  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const thresholdMap = useMemo(() => Object.fromEntries(thresholds.map((item) => [String(item.location_id), item])), [thresholds])

  const rows = useMemo(() => locations.map((location) => {
    const threshold = thresholdMap[String(location.id)] || defaultThreshold(location.id)
    const metric = latest[String(location.id)]
    const occupancy = location.max_capacity
      ? Math.round((Number(metric?.crowd_count || 0) / Number(location.max_capacity)) * 100)
      : 0
    return { location, threshold, metric, occupancy, status: statusFor(occupancy, threshold) }
  }), [latest, locations, thresholdMap])

  const statusCounts = Object.keys(levelStyles).reduce((counts, status) => ({
    ...counts,
    [status]: rows.filter((row) => row.status === status).length,
  }), {})
  const states = [...new Set(locations.map((item) => item.state))].sort()
  const filteredRows = showFilters ? rows.filter((row) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [row.location.name, row.location.state, row.location.location_type]
      .some((value) => value?.toLowerCase().includes(needle))
    const matchesState = stateFilter === 'all' || row.location.state === stateFilter
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter
    return matchesQuery && matchesState && matchesStatus
  }) : rows
  const filtersActive = query || stateFilter !== 'all' || statusFilter !== 'all'

  function beginEdit(row) {
    setEditing(row.location.id)
    setDraft({ ...row.threshold, notification_email: row.threshold.notification_email || '' })
    setMessage('')
    setFieldErrors({})
  }

  function changeDraft(event) {
    const { name, value, type, checked } = event.target
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function save(event) {
    event.preventDefault()
    const caution = Number(draft.caution_percent)
    const warning = Number(draft.warning_percent)
    const critical = Number(draft.critical_percent)
    const nextErrors = {}
    if (!Number.isFinite(caution) || caution < 1 || caution > 100) nextErrors.caution_percent = 'Enter a percentage from 1 to 100.'
    if (!Number.isFinite(warning) || warning < 1 || warning > 100) nextErrors.warning_percent = 'Enter a percentage from 1 to 100.'
    if (!Number.isFinite(critical) || critical < 1 || critical > 100) nextErrors.critical_percent = 'Enter a percentage from 1 to 100.'
    if (!nextErrors.caution_percent && !nextErrors.warning_percent && caution >= warning) nextErrors.warning_percent = 'Warning must be higher than caution.'
    if (!nextErrors.warning_percent && !nextErrors.critical_percent && warning >= critical) nextErrors.critical_percent = 'Critical must be higher than warning.'
    if (draft.notification_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.notification_email.trim())) nextErrors.notification_email = 'Enter a valid notification email.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setMessage('Thresholds must follow: 0 < Caution < Warning < Critical <= 100.')
      toast.reminder('Please correct the highlighted threshold fields.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await saveCrowdThreshold(user.id, draft)
      await onDataChange()
      setEditing(null)
      setDraft(null)
      setMessage('Crowd threshold saved to Supabase.')
      toast.success('Crowd threshold saved successfully.')
    } catch (saveError) {
      const failure = saveError.message || 'Unable to save crowd threshold.'
      setMessage(failure)
      toast.error(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedded ? 'flex flex-col gap-6' : 'mx-auto flex max-w-6xl flex-col gap-6'}>
      {!embedded && <header>
        <h1 className="text-2xl font-bold text-slate-900">Crowd Thresholds</h1>
        <p className="mt-1 text-sm text-slate-500">Configure occupancy alerts for each managed ecological location</p>
      </header>}

      {showSummary && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(levelStyles).map(([key, level]) => (
          <article key={key} className="rounded-2xl border p-4 shadow-sm" style={{ background: level.background, borderColor: `${level.color}30` }}>
            <span className="grid size-8 place-items-center rounded-lg bg-white" style={{ color: level.color }}><Activity size={16} /></span>
            <h2 className="mt-3 font-bold" style={{ color: level.color }}>{level.label}</h2>
            <p className="mt-1 text-2xl font-bold text-slate-800">{loading ? '-' : statusCounts[key]}</p>
          </article>
        ))}
      </div>}

      {(error || message) && <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error || /unable|must/i.test(message) ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error || message}</p></div>}

      {showFilters && <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All states</option>{states.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All risk levels</option>{Object.entries(levelStyles).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
          {filtersActive && <button type="button" onClick={() => { setQuery(''); setStateFilter('all'); setStatusFilter('all') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Clear</button>}
        </div>
        <p className="mt-2 text-right text-xs text-slate-400">Showing {filteredRows.length} of {rows.length} locations</p>
      </section>}

      <section className="space-y-4">
        {filteredRows.map((row) => {
          const style = levelStyles[row.status]
          const isEditing = editing === row.location.id
          return (
            <article key={row.location.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-500"><MapPin size={18} /></span><div><h2 className="font-bold text-slate-800">{row.location.name}</h2><p className="text-xs text-slate-400">{row.location.state} · {row.metric?.crowd_count || 0} / {row.location.max_capacity} visitors</p></div></div>
                <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ color: style.color, background: style.background }}>{row.status === 'optimal' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}{style.label} · {row.occupancy}%</span>{!isEditing && <button type="button" onClick={() => beginEdit(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">Edit rules</button>}</div>
              </div>
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, row.occupancy)}%`, background: style.color }} /></div>
              <div className="mt-2 grid grid-cols-3 text-xs text-slate-400"><span>Caution {row.threshold.caution_percent}%</span><span className="text-center">Warning {row.threshold.warning_percent}%</span><span className="text-right">Critical {row.threshold.critical_percent}%</span></div>

              {isEditing && draft && (
                <form onSubmit={save} noValidate className="mt-5 rounded-xl bg-slate-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ThresholdInput label="Caution %" name="caution_percent" value={draft.caution_percent} onChange={changeDraft} error={fieldErrors.caution_percent} />
                    <ThresholdInput label="Warning %" name="warning_percent" value={draft.warning_percent} onChange={changeDraft} error={fieldErrors.warning_percent} />
                    <ThresholdInput label="Critical %" name="critical_percent" value={draft.critical_percent} onChange={changeDraft} error={fieldErrors.critical_percent} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <label className="min-w-64 flex-1"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Notification email</span><input type="email" name="notification_email" value={draft.notification_email} onChange={changeDraft} placeholder="alerts@ecoguard.my" aria-invalid={Boolean(fieldErrors.notification_email)} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${fieldErrors.notification_email ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500'}`} />{fieldErrors.notification_email && <span className="mt-1 block text-xs text-red-500">{fieldErrors.notification_email}</span>}</label>
                    <label className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><input type="checkbox" name="auto_alerts" checked={draft.auto_alerts} onChange={changeDraft} className="size-4 accent-blue-500" /><Bell size={15} /> Auto alerts</label>
                    <div className="flex gap-2"><button type="button" onClick={() => { setEditing(null); setDraft(null) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{saving ? 'Saving...' : 'Save'}</button></div>
                  </div>
                </form>
              )}
            </article>
          )
        })}
        {!loading && !filteredRows.length && <p className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{rows.length ? 'No crowd thresholds match the current filters.' : 'Add an ecological location before configuring its crowd threshold.'}</p>}
      </section>
    </div>
  )
}

function ThresholdInput({ label, error, ...props }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input type="number" min="1" max="100" required {...props} aria-invalid={Boolean(error)} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500'}`} />{error && <span className="mt-1 block text-xs text-red-500">{error}</span>}</label>
}
