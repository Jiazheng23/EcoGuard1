import { useEffect, useMemo, useRef, useState } from 'react'
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
  CalendarDays,
  ChevronDown,
  Clock3,
  CloudSun,
  History,
  RadioTower,
  Search,
  Thermometer,
  Users,
  Waves,
  X,
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
  const [dateMode, setDateMode] = useState('range')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const dateFilterRef = useRef(null)
  const [history, setHistory] = useState([])
  const [historyAvailable, setHistoryAvailable] = useState(null)
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const needle = query.trim().toLowerCase()
  const selectedRange = useMemo(
    () => getSelectedRange(dateMode, customRange, selectedMonth, selectedYear),
    [customRange, dateMode, selectedMonth, selectedYear],
  )

  useEffect(() => {
    function closeDateFilter(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && dateFilterRef.current?.contains(event.target)) return
      setDateFilterOpen(false)
    }
    document.addEventListener('pointerdown', closeDateFilter)
    document.addEventListener('keydown', closeDateFilter)
    return () => {
      document.removeEventListener('pointerdown', closeDateFilter)
      document.removeEventListener('keydown', closeDateFilter)
    }
  }, [])

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
          ].slice(0, 50000))
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
    const recordedAt = new Date(metric.recorded_at).getTime()
    const matchesDate = Number.isFinite(recordedAt)
      && (!selectedRange.start || recordedAt >= selectedRange.start)
      && (!selectedRange.end || recordedAt <= selectedRange.end)
    return matchesDate && visibleLocationIds.has(String(metric.location_id))
  }), [analyticsMetrics, selectedRange, visibleLocationIds])

  const visitorDensity = useMemo(
    () => buildVisitorDensitySeries(filteredMetrics, filteredLocations, selectedRange.granularity),
    [filteredLocations, filteredMetrics, selectedRange.granularity],
  )
  const locationDensity = useMemo(
    () => buildLocationDensity(filteredMetrics, filteredLocations),
    [filteredLocations, filteredMetrics],
  )
  const environmentalTrend = useMemo(
    () => buildEnvironmentalTrend(filteredMetrics, selectedRange.granularity),
    [filteredMetrics, selectedRange.granularity],
  )
  const summary = useMemo(
    () => getEnvironmentalSummary(filteredMetrics, visitorDensity),
    [filteredMetrics, visitorDensity],
  )
  const warnings = useMemo(
    () => buildCurrentEnvironmentalWarnings(filteredMetrics, filteredLocations, thresholds),
    [filteredLocations, filteredMetrics, thresholds],
  )
  const warningsByLatest = useMemo(
    () => [...warnings].sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime()),
    [warnings],
  )
  const visibleWarnings = showAllWarnings ? warningsByLatest : warningsByLatest.slice(0, 3)
  const peak = summary.peakPeriod

  function resetFilters() {
    setQuery('')
    setLocationFilter('all')
    setDateMode('range')
    setCustomRange({ start: '', end: '' })
    setSelectedMonth('')
    setSelectedYear('')
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
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location, state or type" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
            </label>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500">
              <option value="all">All ecological locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <PeriodFilter ref={dateFilterRef} mode={dateMode} onModeChange={setDateMode} range={customRange} onRangeChange={setCustomRange} month={selectedMonth} onMonthChange={setSelectedMonth} year={selectedYear} onYearChange={setSelectedYear} open={dateFilterOpen} onOpenChange={setDateFilterOpen} selectedRange={selectedRange} />
            {(query || locationFilter !== 'all' || selectedRange.hasFilter) && <button type="button" onClick={resetFilters} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Reset</button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Assigned-location analytics</p>
              <p className="mt-0.5 text-xs text-slate-400">Only readings for your assigned ecological location are included</p>
            </div>
            <PeriodFilter ref={dateFilterRef} mode={dateMode} onModeChange={setDateMode} range={customRange} onRangeChange={setCustomRange} month={selectedMonth} onMonthChange={setSelectedMonth} year={selectedYear} onYearChange={setSelectedYear} open={dateFilterOpen} onOpenChange={setDateFilterOpen} selectedRange={selectedRange} />
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
          {visibleWarnings.map((warning) => (
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
        {warnings.length > 3 && (
          <div className="mt-4 flex justify-center border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowAllWarnings((current) => !current)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
              {showAllWarnings ? 'Show less' : `Show all (${warnings.length})`}
            </button>
          </div>
        )}
        {!warnings.length && <EmptyState text="No current reading exceeds an environmental or crowd threshold." compact />}
      </article>
    </div>
  )
}

function PeriodFilter({ ref, mode, onModeChange, range, onRangeChange, month, onMonthChange, year, onYearChange, open, onOpenChange, selectedRange }) {
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => onOpenChange(!open)} aria-haspopup="dialog" aria-expanded={open} className={`flex w-full min-w-52 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${selectedRange.hasFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'} hover:border-blue-400`}>
        <CalendarDays size={16} /><span className="min-w-0 flex-1 truncate text-left font-medium">{selectedRange.label}</span><ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="dialog" aria-label="Filter analytics by date" className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            {['range', 'month', 'year'].map((item) => <button key={item} type="button" onClick={() => onModeChange(item)} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize ${mode === item ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{item}</button>)}
          </div>
          <div className="mt-4">
            {mode === 'range' ? (
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs font-semibold text-slate-500">From</span><input type="date" value={range.start} max={range.end || undefined} onChange={(event) => onRangeChange((current) => ({ ...current, start: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-xs font-semibold text-slate-500">To</span><input type="date" value={range.end} min={range.start || undefined} onChange={(event) => onRangeChange((current) => ({ ...current, end: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
              </div>
            ) : mode === 'month' ? (
              <label><span className="mb-1 block text-xs font-semibold text-slate-500">Choose month</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
            ) : (
              <label><span className="mb-1 block text-xs font-semibold text-slate-500">Choose year</span><input type="number" min="2000" max="2100" placeholder="e.g. 2026" value={year} onChange={(event) => onYearChange(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <button type="button" disabled={!selectedRange.hasFilter} onClick={() => { onRangeChange({ start: '', end: '' }); onMonthChange(''); onYearChange('') }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40"><X size={13} /> Clear</button>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

function getSelectedRange(mode, range, month, year) {
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 2000 && Number(year) <= 2100
  const monthEnd = month ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate() : null
  const from = mode === 'range' ? range.start : mode === 'month' && month ? `${month}-01` : mode === 'year' && validYear ? `${year}-01-01` : ''
  const to = mode === 'range' ? range.end : mode === 'month' && month ? `${month}-${monthEnd}` : mode === 'year' && validYear ? `${year}-12-31` : ''
  const label = mode === 'month' && month ? new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : mode === 'year' && validYear ? year : from || to ? `${from || 'Any'} – ${to || 'Any'}` : 'Any date'
  const start = from ? new Date(`${from}T00:00:00`).getTime() : null
  const end = to ? new Date(`${to}T23:59:59.999`).getTime() : null
  const spanDays = start && end ? (end - start) / (24 * 60 * 60 * 1000) : null
  const granularity = mode === 'year' && validYear ? 'month'
    : mode === 'month' && month ? 'day'
      : spanDays != null ? spanDays <= 2 ? 'hour' : spanDays <= 45 ? 'day' : spanDays <= 180 ? 'week' : 'month'
        : undefined
  return { start, end, hasFilter: Boolean(from || to), label, granularity }
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
