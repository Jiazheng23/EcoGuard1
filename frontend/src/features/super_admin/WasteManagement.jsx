import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, CloudSun, Recycle, Save, Search, ThermometerSun, Trash2, Users, Waves } from 'lucide-react'
import { createLocationMetric, createSimulatedMetric, latestMetricsByLocation } from '../../services/locationService'

export default function WasteManagement({ locations, metrics, loading, error, onDataChange }) {
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const latest = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const states = [...new Set(locations.map((item) => item.state))].sort()
  const filteredLocations = locations.filter((location) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [location.name, location.state, location.location_type]
      .some((value) => value?.toLowerCase().includes(needle))
    return matchesQuery && (stateFilter === 'all' || location.state === stateFilter)
  })
  const selected = filteredLocations.find((item) => String(item.id) === String(selectedId)) || filteredLocations[0]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <div><h1 className="text-2xl font-bold text-slate-900">Waste Management</h1><p className="mt-1 text-sm text-slate-500">Simulated environmental readings drift slowly and save as timestamped snapshots</p></div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
          <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search monitored location" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All states</option>{states.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Monitored location" value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"><option value="" disabled>Select monitored location</option>{filteredLocations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.location_type}</option>)}</select>
          {(query || stateFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setStateFilter('all') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Clear</button>}
        </div>
        <p className="mt-2 text-right text-xs text-slate-400">{filteredLocations.length} matching locations</p>
      </section>

      {error && <Notice message={error} error />}
      {!loading && !selected && <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400">{locations.length ? 'No monitored location matches the current filters.' : 'Add an ecological location before simulating environmental data.'}</div>}
      {selected && <MetricSimulator key={`${selected.id}-${latest[String(selected.id)]?.id || 'new'}`} location={selected} baseline={latest[String(selected.id)]} onDataChange={onDataChange} />}
    </div>
  )
}

function MetricSimulator({ location, baseline, onDataChange }) {
  const [metric, setMetric] = useState(() => createSimulatedMetric(location, baseline))
  const [history, setHistory] = useState(() => [Number(baseline?.waste_kg || metric.waste_kg)])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMetric((current) => {
        const next = createSimulatedMetric(location, current)
        setHistory((items) => [...items.slice(-17), next.waste_kg])
        return next
      })
    }, 3500)
    return () => window.clearInterval(timer)
  }, [location])

  async function saveSnapshot() {
    setSaving(true)
    setMessage('')
    try {
      await createLocationMetric(metric)
      await onDataChange()
      setMessage('Snapshot saved to Supabase and is now available in Reports.')
    } catch (saveError) {
      setMessage(saveError.message || 'Unable to save simulated snapshot.')
    } finally {
      setSaving(false)
    }
  }

  const recycledRate = metric.waste_kg > 0 ? (metric.recycled_kg / metric.waste_kg) * 100 : 0
  const occupancy = (metric.crowd_count / Number(location.max_capacity)) * 100

  return (
    <>
      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="relative grid size-10 place-items-center rounded-xl bg-white text-blue-500"><Activity size={18} /><span className="absolute right-0 top-0 size-2 rounded-full bg-green-400 ring-2 ring-white" /></span><div><p className="font-bold text-slate-800">Live demo · {location.name}</p><p className="text-xs text-slate-500">Values update every 3.5 seconds; nothing is persisted until Save snapshot.</p></div></div><button type="button" onClick={saveSnapshot} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"><Save size={16} />{saving ? 'Saving...' : 'Save snapshot'}</button></div>
      </section>

      {message && <Notice message={message} error={/unable/i.test(message)} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Waste collected" value={`${metric.waste_kg.toFixed(2)} kg`} detail="Slow random drift" icon={Trash2} color="#f97316" />
        <MetricCard label="Recycled material" value={`${metric.recycled_kg.toFixed(2)} kg`} detail={`${recycledRate.toFixed(0)}% of waste`} icon={Recycle} color="#22c55e" />
        <MetricCard label="Current visitors" value={metric.crowd_count} detail={`${occupancy.toFixed(0)}% of capacity`} icon={Users} color="#3b82f6" />
        <MetricCard label="Air quality index" value={metric.air_quality_index} detail={metric.air_quality_index <= 50 ? 'Good' : metric.air_quality_index <= 100 ? 'Moderate' : 'Unhealthy'} icon={CloudSun} color="#8b5cf6" />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold text-slate-800">Waste trend simulator</h2><p className="mt-1 text-xs text-slate-400">Recent in-browser demo readings</p></div><Trash2 size={20} className="text-orange-500" /></div><MiniChart values={history} /><div className="mt-2 flex justify-between text-xs text-slate-400"><span>Earlier</span><span>Latest {metric.waste_kg.toFixed(2)} kg</span></div></article>
        <article className="rounded-2xl bg-gradient-to-br from-teal-600 to-blue-600 p-6 text-white shadow-lg shadow-blue-600/15"><Waves size={27} /><h2 className="mt-4 text-xl font-bold">Environmental snapshot</h2><div className="mt-5 space-y-3"><Reading icon={Waves} label="Water quality" value={`${metric.water_quality_score.toFixed(1)} / 100`} /><Reading icon={ThermometerSun} label="Temperature" value={`${metric.temperature_c.toFixed(1)} °C`} /><Reading icon={Users} label="Location capacity" value={Number(location.max_capacity).toLocaleString()} /></div><p className="mt-5 text-xs leading-5 text-white/70">Saved snapshots provide the shared historical source for Reports & Environmental Data.</p></article>
      </section>
    </>
  )
}

function MiniChart({ values }) {
  const points = values.map((value, index) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100
    const y = max === min ? 50 : 90 - ((value - min) / (max - min)) * 75
    return `${x},${y}`
  }).join(' ')
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-5 h-40 w-full overflow-visible"><defs><linearGradient id="waste-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".28" /><stop offset="100%" stopColor="#f97316" stopOpacity="0" /></linearGradient></defs><polyline points={`0,100 ${points} 100,100`} fill="url(#waste-fill)" stroke="none" /><polyline points={points} fill="none" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function MetricCard({ label, value, detail, icon: Icon, color }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="grid size-9 place-items-center rounded-xl" style={{ color, background: `${color}12` }}><Icon size={18} /></span><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p><p className="mt-1 text-xs" style={{ color }}>{detail}</p></article>
}

function Reading({ icon: Icon, label, value }) {
  return <div className="flex items-center justify-between rounded-xl bg-white/10 p-3"><span className="flex items-center gap-2 text-sm text-white/80"><Icon size={16} />{label}</span><b className="text-sm">{value}</b></div>
}

function Notice({ message, error }) {
  return <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{message}</p></div>
}
