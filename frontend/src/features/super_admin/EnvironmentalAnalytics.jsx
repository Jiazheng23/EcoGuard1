import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Clock3,
  CloudSun,
  History,
  RadioTower,
  Search,
  Thermometer,
  Users,
  Waves,
} from 'lucide-react'
import {
  listEnvironmentalMetricHistory,
  subscribeToEnvironmentalMetricHistory,
} from '../../services/locationService'
import {
  buildCurrentEnvironmentalWarnings,
  buildEnvironmentalTrend,
  buildLocationDensity,
  buildVisitorDensitySeries,
  getEnvironmentalSummary,
} from '../../utils/environmentalAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'
const tooltipStyle = { border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }
const severityStyle = {
  caution: 'border-amber-200 bg-amber-50 text-amber-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
}

export default function EnvironmentalAnalytics({
  locations,
  metrics,
  thresholds,
  loading,
  error,
  isSuperAdmin = false,
}) {
  const [query, setQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [referenceTime] = useState(() => Date.now())
  const [history, setHistory] = useState([])
  const [historyAvailable, setHistoryAvailable] = useState(null)
  const needle = query.trim().toLowerCase()
  const startTimestamp = dateRange === 'all'
    ? null
    : referenceTime - Number(dateRange) * 24 * 60 * 60 * 1000

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    async function loadHistory() {
      try {
        const rows = await listEnvironmentalMetricHistory()
        if (!active) return
        setHistory(rows)
        setHistoryAvailable(true)
        unsubscribe = subscribeToEnvironmentalMetricHistory((createdRow) => {
          if (!active || !createdRow?.id) return
          setHistory((current) => [
            createdRow,
            ...current.filter((row) => String(row.id) !== String(createdRow.id)),
          ].slice(0, 5000))
        })
      } catch {
        if (!active) return
        setHistory([])
        setHistoryAvailable(false)
      }
    }

    loadHistory()
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const filteredLocations = useMemo(() => locations.filter((location) => {
    const matchesLocation = locationFilter === 'all' || String(location.id) === locationFilter
    const matchesQuery = !needle || [location.name, location.state, location.location_type]
      .some((value) => value?.toLowerCase().includes(needle))
    return matchesLocation && matchesQuery
  }), [locationFilter, locations, needle])

  const visibleLocationIds = useMemo(
    () => new Set(filteredLocations.map((location) => String(location.id))),
    [filteredLocations],
  )
  const analyticsMetrics = history.length ? history : metrics
  const filteredMetrics = useMemo(() => analyticsMetrics.filter((metric) => {
    const matchesDate = !startTimestamp || new Date(metric.recorded_at).getTime() >= startTimestamp
    return matchesDate && visibleLocationIds.has(String(metric.location_id))
  }), [analyticsMetrics, startTimestamp, visibleLocationIds])

  const visitorDensity = useMemo(
    () => buildVisitorDensitySeries(filteredMetrics, filteredLocations, dateRange),
    [dateRange, filteredLocations, filteredMetrics],
  )
  const locationDensity = useMemo(
    () => buildLocationDensity(filteredMetrics, filteredLocations),
    [filteredLocations, filteredMetrics],
  )
  const environmentalTrend = useMemo(
    () => buildEnvironmentalTrend(filteredMetrics, dateRange),
    [dateRange, filteredMetrics],
  )
  const summary = useMemo(
    () => getEnvironmentalSummary(filteredMetrics, visitorDensity),
    [filteredMetrics, visitorDensity],
  )
  const warnings = useMemo(
    () => buildCurrentEnvironmentalWarnings(filteredMetrics, filteredLocations, thresholds),
    [filteredLocations, filteredMetrics, thresholds],
  )
  const peak = summary.peakPeriod

  function resetFilters() {
    setQuery('')
    setLocationFilter('all')
    setDateRange('all')
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Environmental Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Visitor-density and environmental trends from ecological-location sensors</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
          <RadioTower size={15} className="animate-pulse" /> Live sensor data
        </span>
      </header>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {historyAvailable === false && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <History size={17} className="mt-0.5 shrink-0" />
          <p>Historical sensor storage is not active yet. The dashboard is showing the latest available readings.</p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {isSuperAdmin ? (
          <div className="grid gap-3 md:grid-cols-[1fr_220px_170px_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
            </label>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
              <option value="all">All ecological locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <PeriodSelect value={dateRange} onChange={setDateRange} />
            {(query || locationFilter !== 'all' || dateRange !== 'all') && <button type="button" onClick={resetFilters} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Reset</button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Assigned-location analytics</p>
              <p className="mt-0.5 text-xs text-slate-400">Only readings for your assigned ecological location are included</p>
            </div>
            <PeriodSelect value={dateRange} onChange={setDateRange} />
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-3 text-xs text-slate-400">
          <span>{filteredMetrics.length} sensor readings</span>
          <span>{filteredLocations.length} locations</span>
          <span>{warnings.length} current warnings</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Average Visitors', Math.round(summary.averageVisitors).toLocaleString(), Users, '#3b82f6'],
          ['Peak Visitors', peak ? peak.visitors.toLocaleString() : '0', Clock3, '#8b5cf6'],
          ['Average Occupancy', `${summary.averageOccupancy.toFixed(1)}%`, Activity, '#22c55e'],
          ['Current Warnings', warnings.length, AlertTriangle, warnings.length ? '#ef4444' : '#64748b'],
        ].map(([label, value, Icon, color]) => (
          <article key={label} className={card}>
            <Icon size={18} style={{ color }} />
            <p className="mt-3 text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '—' : value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={`${card} lg:col-span-2`}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="font-bold text-slate-800">Visitor density by period</h2><p className="mt-1 text-xs text-slate-400">Aggregated from sensor crowd-count readings</p></div>
            <span className="text-xs text-slate-400">Visitors and occupancy</span>
          </div>
          {visitorDensity.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={visitorDensity} margin={{ left: -12, right: 8 }}>
                <defs><linearGradient id="visitor-density" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity=".28" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="visitors" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="occupancy" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'Occupancy' ? [`${value}%`, name] : [Number(value).toLocaleString(), name]} />
                <Legend />
                <Area yAxisId="visitors" type="monotone" dataKey="visitors" name="Visitors" stroke="#3b82f6" fill="url(#visitor-density)" strokeWidth={2.5} isAnimationActive={false} />
                <Line yAxisId="occupancy" type="monotone" dataKey="occupancy" name="Occupancy" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No sensor readings are available for the selected period." />}
        </article>

        <article className={card}>
          <h2 className="font-bold text-slate-800">Peak visitor period</h2>
          <p className="mt-1 text-xs text-slate-400">Highest visitor density in this selection</p>
          {peak ? (
            <div className="mt-6">
              <span className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Clock3 size={22} /></span>
              <p className="mt-4 text-3xl font-bold text-violet-600">{peak.visitors.toLocaleString()}</p>
              <p className="text-sm font-semibold text-slate-700">visitors during {peak.period}</p>
              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                <SummaryRow label="Occupancy" value={`${peak.occupancy.toFixed(1)}%`} />
                <SummaryRow label="Locations represented" value={peak.locationCount} />
                <SummaryRow label="Sensor samples" value={peak.readingCount} />
              </div>
            </div>
          ) : <EmptyState text="A peak period will appear after sensor data is recorded." compact />}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <h2 className="font-bold text-slate-800">Latest visitor density by location</h2>
          <p className="mb-4 mt-1 text-xs text-slate-400">Most recent sensor reading for each location</p>
          {locationDensity.length ? (
            <ResponsiveContainer width="100%" height={Math.max(280, locationDensity.length * 42)}>
              <BarChart data={locationDensity} layout="vertical" margin={{ left: 20, right: 14 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toLocaleString(), 'Visitors']} />
                <Bar dataKey="visitors" name="Visitors" fill="#3b82f6" radius={[0, 5, 5, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No current visitor readings match this filter." />}
        </article>

        <article className={card}>
          <h2 className="font-bold text-slate-800">Environmental sensor trend</h2>
          <p className="mb-4 mt-1 text-xs text-slate-400">Average AQI, water-quality score and temperature</p>
          {environmentalTrend.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={environmentalTrend} margin={{ left: -12, right: 8 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="aqi" name="AQI" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="water" name="Water quality" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="temperature" name="Temperature °C" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No environmental readings match this filter." />}
        </article>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Sensor Readings', filteredMetrics.length, RadioTower, '#3b82f6'],
          ['Average AQI', summary.averageAqi.toFixed(0), CloudSun, '#8b5cf6'],
          ['Water Quality', `${summary.averageWater.toFixed(0)} / 100`, Waves, '#0ea5e9'],
          ['Temperature', `${summary.averageTemperature.toFixed(1)} °C`, Thermometer, '#f97316'],
        ].map(([label, value, Icon, color]) => (
          <article key={label} className={card}>
            <Icon size={18} style={{ color }} />
            <p className="mt-3 text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '—' : value}</p>
          </article>
        ))}
      </section>

      <article className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-bold text-slate-800">Current early warnings</h2><p className="mt-1 text-xs text-slate-400">Calculated from the latest crowd, air, water and temperature readings</p></div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${warnings.length ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{warnings.length ? `${warnings.length} active` : 'No active warning'}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {warnings.slice(0, 8).map((warning) => (
            <div key={warning.key} className={`rounded-xl border p-4 ${severityStyle[warning.severity] || severityStyle.caution}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{warning.title}</b><span className="text-[10px] font-bold uppercase tracking-wider">{warning.severity}</span></div>
                  <p className="mt-1 text-xs leading-5 opacity-80">{warning.detail}</p>
                  <p className="mt-2 text-[11px] opacity-70">{warning.category} · {formatDateTime(warning.recordedAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!warnings.length && <EmptyState text="No current reading exceeds an environmental or crowd threshold." compact />}
      </article>
    </div>
  )
}

function PeriodSelect({ value, onChange }) {
  return (
    <select aria-label="Analytics period" value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="all">All recorded data</option>
    </select>
  )
}

function SummaryRow({ label, value }) {
  return <p className="flex justify-between"><span>{label}</span><b className="text-slate-700">{value}</b></p>
}

function EmptyState({ text, compact = false }) {
  return <p className={`${compact ? 'py-8' : 'py-20'} text-center text-sm text-slate-400`}>{text}</p>
}

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
