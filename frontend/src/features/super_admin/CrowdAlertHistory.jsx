import { crowdOccupancy } from '../../utils/reportFilters'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { listCrowdAlertHistory } from '../../services/crowdHistoryService'
import { subscribeToEarlyWarnings } from '../../services/notificationService'
import { crowdLevels, filterCrowdHistory } from '../../utils/crowdThresholds'

const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-500'

export default function CrowdAlertHistory({ locations, selectedLocationId, isSuperAdmin, onBack }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [level, setLevel] = useState('all')
  const [status, setStatus] = useState('all')
  const [reload, setReload] = useState(0)
  const scopeKey = JSON.stringify(locations.map((location) => String(location.id)).sort())

  useEffect(() => {
    let active = true
    let request = 0
    async function load() {
      const current = ++request
      setLoading(true)
      setError('')
      try {
        const rows = await listCrowdAlertHistory(JSON.parse(scopeKey))
        if (active && current === request) setRecords(rows)
      } catch (failure) {
        if (active && current === request) setError(failure.message || 'Unable to load crowd alert history.')
      } finally {
        if (active && current === request) setLoading(false)
      }
    }
    void load()
    const unsubscribe = subscribeToEarlyWarnings(load)
    return () => { active = false; unsubscribe() }
  }, [scopeKey, reload])

  const location = selectedLocationId ?? (isSuperAdmin ? locationFilter : locations[0]?.id ?? '')
  const visible = useMemo(() => filterCrowdHistory(records, JSON.parse(scopeKey), { location, level, status }), [records, scopeKey, location, level, status])
  const names = Object.fromEntries(locations.map((item) => [String(item.id), item]))
  const title = location === 'all' ? 'All locations' : names[String(location)]?.name || 'Assigned location'

  return <div className="flex flex-col gap-5">
    <header>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"><ArrowLeft size={16} />Back to Threshold List</button>
      <h1 className="text-2xl font-bold text-slate-900">Crowd Alert History</h1>
      <p className="mt-1 text-sm text-slate-500" aria-live="polite">{title} · {loading ? 'Loading records…' : error ? 'Records unavailable' : `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`}</p>
    </header>
    <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-100 bg-white p-4">
      {isSuperAdmin && selectedLocationId == null && <label className="grid gap-1 text-xs font-semibold text-slate-500">Location<select className={control} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="all">All Locations</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label className="grid gap-1 text-xs font-semibold text-slate-500">Alert level<select className={control} value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All Levels</option>{['caution', 'warning', 'critical'].map((key) => <option key={key} value={key}>{crowdLevels[key].label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-slate-500">Status<select className={control} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Statuses</option><option value="resolved">Resolved</option><option value="unresolved">Unresolved</option></select></label>
      <button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="ml-auto inline-flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 disabled:opacity-50"><RefreshCw size={15} />Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm" aria-busy={loading}>
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['ID', 'Location', 'Date & Time', 'Occupancy When Triggered', 'Triggered', 'Level', 'Status'].map((label) => <th key={label} className="px-4 py-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {!loading && !error && visible.map((row) => {
            const style = crowdLevels[row.severity]
            const resolved = Boolean(row.resolved_at)
            const Icon = resolved ? CheckCircle2 : AlertTriangle
            return <tr key={row.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-4 text-slate-400">#{row.id}</td>
              <td className="px-4 py-4"><b className="text-slate-800">{names[String(row.location_id)]?.name}</b><p className="mt-1 text-xs text-slate-400">{names[String(row.location_id)]?.state}</p></td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-600">{new Date(row.created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td className="px-4 py-4 font-semibold text-slate-700" title="Stored alert occupancy. Active alerts may be updated; the original trigger value is not guaranteed." aria-label={`Stored alert occupancy: ${crowdOccupancy(row)}. Active alerts may be updated; the original trigger value is not guaranteed.`}>{crowdOccupancy(row)}</td>
              <td className="px-4 py-4 text-slate-600">{style?.label || row.severity} Threshold<p className="mt-1 text-xs text-slate-400">{row.threshold_value}{row.unit}</p></td>
              <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: style?.color, background: style?.background }}>{style?.label || row.severity}</span></td>
              <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${resolved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><Icon size={13} />{resolved ? 'Resolved' : 'Unresolved'}</span></td>
            </tr>
          })}
          {(loading || error || !visible.length) && <tr><td colSpan={7} className="p-12 text-center text-slate-400">{loading ? 'Loading crowd alert history…' : error ? 'History could not be loaded. Please retry.' : 'No crowd alerts match the selected filters.'}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
}
