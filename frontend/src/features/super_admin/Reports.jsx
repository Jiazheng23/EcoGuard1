import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, CloudSun, Download, Leaf, Recycle, Route, Search, Sparkles, Waves } from 'lucide-react'
import ReportDownloadDialog from '../../components/ReportDownloadDialog'
import { latestMetricsByLocation } from '../../services/locationService'
import { adminReportFilename, buildAdminTripPdfBytes, buildEnvironmentalPdfBytes } from '../../utils/adminReport'
import { downloadWasteReport } from '../../utils/wasteReport'
import {
  getDestinationSeries,
  getMonthlySeries,
  getTransportSeries,
  getTripSummary,
} from '../../utils/tripAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function Reports({ profiles, trips, locations, metrics, loading, error }) {
  const [query, setQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [dateRange, setDateRange] = useState('30')
  const [filterReferenceTime] = useState(() => Date.now())
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState('')
  const selectedLocation = locations.find((location) => String(location.id) === locationFilter)
  const startTimestamp = dateRange === 'all'
    ? null
    : filterReferenceTime - Number(dateRange) * 24 * 60 * 60 * 1000
  const needle = query.trim().toLowerCase()
  const filteredLocations = useMemo(() => locations.filter((location) => {
    const matchesLocation = locationFilter === 'all' || String(location.id) === locationFilter
    const matchesQuery = !needle || [location.name, location.state, location.location_type]
      .some((value) => value?.toLowerCase().includes(needle))
    return matchesLocation && matchesQuery
  }), [locationFilter, locations, needle])
  const filteredTrips = useMemo(() => trips.filter((trip) => {
    const matchesDate = !startTimestamp || new Date(trip.travelled_at).getTime() >= startTimestamp
    const matchesLocation = !selectedLocation
      || trip.destination?.trim().toLowerCase() === selectedLocation.name.trim().toLowerCase()
    const matchesQuery = !needle || [trip.starting_location, trip.destination, trip.transport_mode]
      .some((value) => value?.toLowerCase().includes(needle))
    return matchesDate && matchesLocation && matchesQuery
  }), [needle, selectedLocation, startTimestamp, trips])
  const visibleLocationIds = useMemo(() => new Set(filteredLocations.map((location) => String(location.id))), [filteredLocations])
  const filteredMetrics = useMemo(() => metrics.filter((metric) => {
    const matchesDate = !startTimestamp || new Date(metric.recorded_at).getTime() >= startTimestamp
    return matchesDate && visibleLocationIds.has(String(metric.location_id))
  }), [metrics, startTimestamp, visibleLocationIds])

  const analytics = useMemo(() => ({
    summary: getTripSummary(filteredTrips, profiles),
    monthly: getMonthlySeries(filteredTrips),
    destinations: getDestinationSeries(filteredTrips).slice(0, 8),
    transport: getTransportSeries(filteredTrips),
  }), [filteredTrips, profiles])
  const environmental = useMemo(() => {
    const latest = latestMetricsByLocation(filteredMetrics)
    const byLocation = filteredLocations.map((location) => {
      const metric = latest[String(location.id)] || {}
      return {
        name: location.name,
        waste: Number(metric.waste_kg || 0),
        recycled: Number(metric.recycled_kg || 0),
        aqi: Number(metric.air_quality_index || 0),
        water: Number(metric.water_quality_score || 0),
      }
    })
    const snapshotCount = filteredMetrics.length
    const averageAqi = byLocation.length ? byLocation.reduce((sum, item) => sum + item.aqi, 0) / byLocation.length : 0
    const averageWater = byLocation.length ? byLocation.reduce((sum, item) => sum + item.water, 0) / byLocation.length : 0
    const totalWaste = byLocation.reduce((sum, item) => sum + item.waste, 0)
    return { byLocation, snapshotCount, averageAqi, averageWater, totalWaste }
  }, [filteredLocations, filteredMetrics])

  function exportCsv() {
    const header = ['id', 'tourist_id', 'starting_location', 'destination', 'transport_mode', 'distance_km', 'passengers', 'round_trip', 'carbon_emission', 'total_emission', 'eco_points', 'travelled_at']
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [header.join(','), ...filteredTrips.map((trip) => header.map((key) => escape(trip[key])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ecoguard-trips-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportEnvironmentalCsv() {
    const header = ['id', 'location_id', 'location_name', 'crowd_count', 'waste_kg', 'recycled_kg', 'air_quality_index', 'water_quality_score', 'temperature_c', 'source', 'recorded_at']
    const locationNames = Object.fromEntries(filteredLocations.map((location) => [String(location.id), location.name]))
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = filteredMetrics.map((metric) => ({ ...metric, location_name: locationNames[String(metric.location_id)] || '' }))
    const csv = [header.join(','), ...rows.map((row) => header.map((key) => escape(row[key])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ecoguard-environment-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadReport(type, format) {
    const generatedAt = new Date()
    const scope = `${selectedLocation?.name || 'All accessible locations'}; ${dateRange === 'all' ? 'all dates' : `last ${dateRange} days`}`
    if (format === 'csv') {
      if (type === 'environment') exportEnvironmentalCsv()
      else exportCsv()
    } else {
      const bytes = type === 'environment'
        ? buildEnvironmentalPdfBytes(filteredMetrics, filteredLocations, { generatedAt, scope })
        : buildAdminTripPdfBytes(filteredTrips, { generatedAt, scope })
      downloadWasteReport(bytes, 'application/pdf', adminReportFilename(type, 'pdf', generatedAt))
    }
    setDownloadMessage(`${type === 'environment' ? 'Environmental' : 'Trip'} report downloaded as ${format.toUpperCase()}.`)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Reports & Environmental Data</h1><p className="mt-1 text-sm text-slate-500">Shared Supabase analytics from trips and saved environmental snapshots</p></div>
        <button type="button" onClick={() => { setDownloadMessage(''); setDownloadDialogOpen(true) }} disabled={!filteredMetrics.length && !filteredTrips.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} />Download</button>
      </header>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {downloadMessage && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{downloadMessage}</div>}

      <ReportDownloadDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        counts={{ environment: filteredMetrics.length, trips: filteredTrips.length }}
        onDownload={downloadReport}
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_170px_auto]">
          <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destination, state or transport" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></label>
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All ecological locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
          {(query || locationFilter !== 'all' || dateRange !== '30') && <button type="button" onClick={() => { setQuery(''); setLocationFilter('all'); setDateRange('30') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Reset</button>}
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-3 text-xs text-slate-400"><span>{filteredTrips.length} trips</span><span>{filteredMetrics.length} environmental snapshots</span><span>{filteredLocations.length} locations</span></div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Average Carbon', `${analytics.summary.averageEmission.toFixed(1)} kg`, BarChart3, '#3b82f6'],
          ['Total Carbon', `${analytics.summary.totalEmission.toFixed(1)} kg`, Leaf, '#ef4444'],
          ['Recorded Trips', analytics.summary.totalTrips, Route, '#22c55e'],
          ['Destinations', analytics.summary.destinationCount, Sparkles, '#8b5cf6'],
        ].map(([label, value, Icon, color]) => <article key={label} className={card}><Icon size={18} style={{ color }} /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '—' : value}</p></article>)}
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Saved Snapshots', environmental.snapshotCount, Recycle, '#22c55e'],
          ['Latest Waste', `${environmental.totalWaste.toFixed(1)} kg`, Leaf, '#f97316'],
          ['Average AQI', environmental.averageAqi.toFixed(0), CloudSun, '#8b5cf6'],
          ['Water Quality', `${environmental.averageWater.toFixed(0)} / 100`, Waves, '#0ea5e9'],
        ].map(([label, value, Icon, color]) => <article key={label} className={card}><Icon size={18} style={{ color }} /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '-' : value}</p></article>)}
      </section>

      <article className={card}>
        <h2 className="mb-1 font-bold text-slate-800">Latest waste and recycling by ecological location</h2>
        <p className="mb-4 text-xs text-slate-400">Updates after a sensor reading is saved in Waste Management</p>
        {environmental.byLocation.length ? <ResponsiveContainer width="100%" height={280}>
          <BarChart data={environmental.byLocation} margin={{ left: -12, right: 8 }}>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={62} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kg`]} />
            <Legend />
            <Bar dataKey="waste" name="Waste" fill="#f97316" radius={[5, 5, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="recycled" name="Recycled" fill="#22c55e" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer> : <p className="p-10 text-center text-sm text-slate-400">No ecological locations are available.</p>}
      </article>

      <article className={card}>
        <h2 className="mb-4 font-bold text-slate-800">Monthly trips and carbon</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={analytics.monthly} margin={{ left: -12, right: 8 }}>
            <defs><linearGradient id="report-carbon" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity=".3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="emission" name="Carbon (kg)" stroke="#3b82f6" fill="url(#report-carbon)" strokeWidth={2.5} isAnimationActive={false} />
            <Area type="monotone" dataKey="trips" name="Trips" stroke="#22c55e" fill="none" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </article>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <h2 className="mb-4 font-bold text-slate-800">Carbon by destination</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.destinations} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip formatter={(value) => [`${value} kg CO₂`, 'Carbon']} />
              <Bar dataKey="emission" fill="#22c55e" radius={[0, 5, 5, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className={card}>
          <h2 className="mb-4 font-bold text-slate-800">Carbon by transport</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.transport} margin={{ left: -16 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip formatter={(value) => [`${value} kg CO₂`, 'Carbon']} />
              <Bar dataKey="emission" fill="#8b5cf6" radius={[5, 5, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>
    </div>
  )
}
