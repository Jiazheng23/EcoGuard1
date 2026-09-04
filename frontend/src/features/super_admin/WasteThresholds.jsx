import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle, MapPin, Search } from 'lucide-react'
import { latestMetricsByLocation } from '../../services/locationService'
import WasteThresholdSettings from './waste/WasteThresholdSettings'

const defaults = { moderate_kg: 25, high_risk_kg: 50, critical_kg: 75 }
const levels = {
  optimal: { label: 'Normal', color: '#22c55e', background: '#f0fdf4' },
  caution: { label: 'Moderate', color: '#f59e0b', background: '#fffbeb' },
  warning: { label: 'High Risk', color: '#f97316', background: '#fff7ed' },
  critical: { label: 'Critical', color: '#ef4444', background: '#fef2f2' },
}

function statusFor(wasteKg, threshold) {
  if (wasteKg >= Number(threshold.critical_kg)) return 'critical'
  if (wasteKg >= Number(threshold.high_risk_kg)) return 'warning'
  if (wasteKg >= Number(threshold.moderate_kg)) return 'caution'
  return 'optimal'
}

export default function WasteThresholds({ locations = [], metrics = [], thresholds = [], loading, error, onThresholdSaved }) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const thresholdMap = useMemo(() => Object.fromEntries(thresholds.map((item) => [String(item.location_id), item])), [thresholds])
  const rows = useMemo(() => locations.map((location) => {
    const threshold = thresholdMap[String(location.id)] || { ...defaults, location_id: location.id }
    const metric = latest[String(location.id)]
    const wasteKg = Number(metric?.waste_kg || 0)
    return { location, threshold, metric, wasteKg, status: statusFor(wasteKg, threshold) }
  }), [latest, locations, thresholdMap])
  const states = [...new Set(locations.map((location) => location.state))].sort()
  const filteredRows = rows.filter((row) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [row.location.name, row.location.state, row.location.location_type].some((value) => value?.toLowerCase().includes(needle))
    return matchesQuery && (stateFilter === 'all' || row.location.state === stateFilter) && (statusFilter === 'all' || row.status === statusFilter)
  })
  const filtersActive = query || stateFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(levels).map(([key, level]) => (
          <article key={key} className="rounded-2xl border p-4 shadow-sm" style={{ background: level.background, borderColor: `${level.color}30` }}>
            <span className="grid size-8 place-items-center rounded-lg bg-white" style={{ color: level.color }}><Activity size={16} /></span>
            <h2 className="mt-3 font-bold" style={{ color: level.color }}>{level.label}</h2>
            <p className="mt-1 text-2xl font-bold text-slate-800">{loading ? '-' : rows.filter((row) => row.status === key).length}</p>
          </article>
        ))}
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All states</option>{states.map((state) => <option key={state}>{state}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All risk levels</option>{Object.entries(levels).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
          {filtersActive && <button type="button" onClick={() => { setQuery(''); setStateFilter('all'); setStatusFilter('all') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Clear</button>}
        </div>
        <p className="mt-2 text-right text-xs text-slate-400">Showing {filteredRows.length} of {rows.length} locations</p>
      </section>

      <section className="space-y-4">
        {filteredRows.map((row) => {
          const style = levels[row.status]
          const expanded = editing === row.location.id
          const scaleMaximum = Math.max(Number(row.threshold.critical_kg), row.wasteKg, 1)
          return (
            <article key={row.location.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><MapPin size={18} /></span><div><h2 className="font-bold text-slate-800">{row.location.name}</h2><p className="text-xs text-slate-400">{row.location.state} · {row.wasteKg.toFixed(2)} kg detected</p></div></div>
                <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ color: style.color, background: style.background }}>{row.status === 'optimal' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}{style.label} · {row.wasteKg.toFixed(2)} kg</span><button type="button" onClick={() => setEditing(expanded ? null : row.location.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">{expanded ? 'Close' : 'Edit rules'}</button></div>
              </div>
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, row.wasteKg / scaleMaximum * 100)}%`, background: style.color }} /></div>
              <div className="mt-2 grid grid-cols-3 text-xs text-slate-400"><span>Moderate {row.threshold.moderate_kg} kg</span><span className="text-center">High Risk {row.threshold.high_risk_kg} kg</span><span className="text-right">Critical {row.threshold.critical_kg} kg</span></div>
              {expanded && <div className="mt-5"><WasteThresholdSettings key={`${row.location.id}-${row.threshold.updated_at || 'defaults'}`} location={row.location} threshold={thresholdMap[String(row.location.id)]} onSaved={onThresholdSaved} embedded /></div>}
            </article>
          )
        })}
        {!loading && !filteredRows.length && <p className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{rows.length ? 'No waste thresholds match the current filters.' : 'Add an ecological location before configuring its waste threshold.'}</p>}
      </section>
    </div>
  )
}
