import { Fragment, useMemo, useState } from 'react'
import { Activity, AlertCircle, Bell, History, Pencil, Save, Search } from 'lucide-react'
import { latestMetricsByLocation, saveCrowdThreshold } from '../../services/locationService'
import { useToast } from '../../components/toastContext'

import { crowdLevels as levelStyles, crowdLevel, crowdRanges } from '../../utils/crowdThresholds'
import CrowdAlertHistory from './CrowdAlertHistory'

const defaultThreshold = (locationId) => ({
  location_id: locationId,
  caution_percent: 60,
  warning_percent: 80,
  critical_percent: 90,
  auto_alerts: true,
  notification_email: '',
})

export default function CrowdThresholds({ user, locations, thresholds, metrics, loading, error, onDataChange, embedded = false, showFilters = true, showSummary = true, isSuperAdmin = false }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const thresholdMap = useMemo(() => Object.fromEntries(thresholds.map((item) => [String(item.location_id), item])), [thresholds])

  const rows = useMemo(() => locations.map((location) => {
    const threshold = thresholdMap[String(location.id)] || defaultThreshold(location.id)
    const metric = latest[String(location.id)]
    const occupancy = Number(location.max_capacity) > 0 && metric?.crowd_count != null
      ? Number(metric.crowd_count) / Number(location.max_capacity) * 100 : null
    return { location, threshold, metric, occupancy, status: crowdLevel(metric?.crowd_count, location.max_capacity, threshold) }
  }), [latest, locations, thresholdMap])

  const statusCounts = Object.keys(levelStyles).reduce((counts, status) => ({
    ...counts,
    [status]: rows.filter((row) => row.status === status).length,
  }), {})
  const filteredRows = showFilters ? rows.filter(({ location }) => [location.name, location.state].some((value) => String(value || '').toLowerCase().includes(query.trim().toLowerCase()))) : rows

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

  if (history) return <CrowdAlertHistory locations={locations} isSuperAdmin={isSuperAdmin} selectedLocationId={history.locationId} onBack={() => setHistory(null)} />

  return (
    <div className={embedded ? 'flex flex-col gap-6' : 'mx-auto flex max-w-7xl flex-col gap-6'}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Crowd Threshold Management</h1><p className="mt-1 text-sm text-slate-500">Configure and monitor crowd thresholds for each ecological location</p></div>
        <button type="button" onClick={() => setHistory({ locationId: null })} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"><History size={17} />Alert History</button>
      </header>

      {showSummary && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(levelStyles).map(([key, level]) => (
          <article key={key} className="rounded-2xl border p-5 shadow-sm" style={{ background: level.background, borderColor: level.color + '30' }}>
            <div className="flex items-center justify-between gap-2" style={{ color: level.color }}><h2 className="text-sm font-semibold">{level.label} Crowd</h2><Activity size={20} /></div>
            <p className="mt-3 text-3xl font-bold text-slate-800">{loading ? '—' : statusCounts[key]}</p><p className="mt-1 text-xs text-slate-500">locations</p>
          </article>
        ))}
      </div>}

      {(error || message) && <div role="status" className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error || message}</p></div>}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {showFilters && <div className="border-b border-slate-100 p-4"><label className="relative block max-w-md"><span className="sr-only">Search location</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500" /></label></div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm" aria-busy={loading}>
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Location', 'Max Capacity', 'Low', 'Moderate', 'High', 'Critical', 'Current Visitors', 'Status', 'Actions'].map((label) => <th key={label} className="px-4 py-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filteredRows.map((row) => {
              const style = levelStyles[row.status]
              const isEditing = editing === row.location.id
              const ranges = crowdRanges(row.location.max_capacity, row.threshold)
              return <Fragment key={row.location.id}>
                <tr className="hover:bg-slate-50/60">
                  <td className="px-4 py-5"><b className="text-slate-800">{row.location.name}</b><p className="mt-1 text-xs text-slate-400">{row.location.state}</p></td>
                  <td className="px-4 py-5 font-semibold text-slate-700">{Number(row.location.max_capacity).toLocaleString()}</td>
                  {ranges.map((range, index) => <td key={index} className="whitespace-nowrap px-4 py-5 text-xs font-semibold" style={{ color: Object.values(levelStyles)[index].color }}>{range}</td>)}
                  <td className="min-w-40 px-4 py-5"><div className="flex justify-between gap-3"><b className="text-slate-700">{row.metric?.crowd_count == null ? '—' : Number(row.metric.crowd_count).toLocaleString()}</b><span className="text-xs text-slate-400">{row.occupancy == null ? 'No reading' : row.occupancy.toFixed(1) + '%'}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: Math.min(100, Math.max(0, row.occupancy || 0)) + '%', background: style?.color || '#94a3b8' }} /></div></td>
                  <td className="px-4 py-5"><span className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold" style={{ color: style?.color || '#64748b', background: style?.background || '#f1f5f9' }}>{style ? style.label + ' Crowd' : 'Unavailable'}</span></td>
                  <td className="px-4 py-5"><div className="flex gap-2"><button type="button" aria-label={'Edit thresholds for ' + row.location.name} onClick={() => beginEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600"><Pencil size={13} />Edit</button><button type="button" aria-label={'Alert history for ' + row.location.name} onClick={() => setHistory({ locationId: row.location.id })} className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-2.5 py-1.5 text-xs font-semibold text-orange-600"><History size={13} />History</button></div></td>
                </tr>
                {isEditing && draft && <tr><td colSpan={9} className="px-4 pb-4">
                <form onSubmit={save} noValidate className="mt-5 rounded-xl bg-slate-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ThresholdInput label="Moderate from (%)" name="caution_percent" value={draft.caution_percent} onChange={changeDraft} error={fieldErrors.caution_percent} />
                    <ThresholdInput label="High from (%)" name="warning_percent" value={draft.warning_percent} onChange={changeDraft} error={fieldErrors.warning_percent} />
                    <ThresholdInput label="Critical from (%)" name="critical_percent" value={draft.critical_percent} onChange={changeDraft} error={fieldErrors.critical_percent} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <label className="min-w-64 flex-1"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Notification email</span><input type="email" name="notification_email" value={draft.notification_email} onChange={changeDraft} placeholder="alerts@ecoguard.my" aria-invalid={Boolean(fieldErrors.notification_email)} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${fieldErrors.notification_email ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500'}`} />{fieldErrors.notification_email && <span className="mt-1 block text-xs text-red-500">{fieldErrors.notification_email}</span>}</label>
                    <label className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><input type="checkbox" name="auto_alerts" checked={draft.auto_alerts} onChange={changeDraft} className="size-4 accent-blue-500" /><Bell size={15} /> Auto alerts</label>
                    <div className="flex gap-2"><button type="button" onClick={() => { setEditing(null); setDraft(null) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={15} />{saving ? 'Saving...' : 'Save'}</button></div>
                  </div>
                </form>
                </td></tr>}
              </Fragment>
            })}
            {(loading || !filteredRows.length) && <tr><td colSpan={9} className="p-12 text-center text-slate-400">{loading ? 'Loading crowd thresholds…' : rows.length ? 'No locations match your search.' : 'No accessible locations available.'}</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  )
}

function ThresholdInput({ label, error, ...props }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span><input type="number" min="1" max="100" required {...props} aria-invalid={Boolean(error)} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500'}`} />{error && <span className="mt-1 block text-xs text-red-500">{error}</span>}</label>
}
