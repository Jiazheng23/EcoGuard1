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
import { isWestMalaysiaCoordinate } from '../../utils/westMalaysia'
import {
  getDestinationSeries,
  getMonthlySeries,
  getTransportSeries,
  getTripSummary,
} from '../../utils/tripAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

function formatDestinationLabel(value, maxLength = 22) {
  const label = String(value || '')
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
}

export default function Reports({ profiles, trips, locations, metrics, loading, error, isSuperAdmin = false, embedded = false }) {
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
  const eastMalaysiaLocationNames = useMemo(() => new Set(
    locations
      .filter((location) => ['sabah', 'sarawak', 'labuan'].includes(String(location.state || '').trim().toLowerCase()))
      .map((location) => location.name.trim().toLowerCase()),
  ), [locations])

  const analytics = useMemo(() => ({
    summary: getTripSummary(filteredTrips, profiles),
    monthly: getMonthlySeries(filteredTrips),
    destinations: getDestinationSeries(filteredTrips)
      .filter((destination) => {
        if (eastMalaysiaLocationNames.has(destination.name.trim().toLowerCase())) return false
        const lat = Number(destination.lat)
        const lng = Number(destination.lng)
        const hasCoordinates = destination.lat !== null && destination.lng !== null
          && Number.isFinite(lat) && Number.isFinite(lng)
        return !hasCoordinates || isWestMalaysiaCoordinate(lat, lng)
      }),
    transport: getTransportSeries(filteredTrips),
  }), [eastMalaysiaLocationNames, filteredTrips, profiles])
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
    const readingCount = filteredMetrics.length
    const averageAqi = byLocation.length ? byLocation.reduce((sum, item) => sum + item.aqi, 0) / byLocation.length : 0
    const averageWater = byLocation.length ? byLocation.reduce((sum, item) => sum + item.water, 0) / byLocation.length : 0
    const totalWaste = byLocation.reduce((sum, item) => sum + item.waste, 0)
    return { byLocation, readingCount, averageAqi, averageWater, totalWaste }
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
    <div className={`${embedded ? '' : 'mx-auto max-w-6xl'} flex flex-col gap-6`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className={`${embedded ? 'text-lg' : 'text-2xl'} font-bold text-slate-900`}>{embedded ? 'Environmental & Travel Reports' : 'Reports & Environmental Data'}</h2><p className="mt-1 text-sm text-slate-500">Shared Supabase analytics from trips and current environmental readings</p></div>
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
        {isSuperAdmin ? (
          <div className="grid gap-3 md:grid-cols-[1fr_220px_170px_auto]">
            <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destination, state or transport" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></label>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="all">All ecological locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
            <select aria-label="Report date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-blue-500"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
            {(query || locationFilter !== 'all' || dateRange !== '30') && <button type="button" onClick={() => { setQuery(''); setLocationFilter('all'); setDateRange('30') }} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Reset</button>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Report period</p>
              <p className="mt-0.5 text-xs text-slate-400">Filter data for your assigned ecological location</p>
            </div>
            <div className="flex items-center gap-2">
              <select aria-label="Report date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 outline-none focus:border-blue-500"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
              {dateRange !== '30' && <button type="button" onClick={() => setDateRange('30')} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">Reset</button>}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-3 text-xs text-slate-400"><span>{filteredTrips.length} trips</span><span>{filteredMetrics.length} environmental readings</span><span>{filteredLocations.length} locations</span></div>
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
          ['Current Readings', environmental.readingCount, Recycle, '#22c55e'],
          ['Latest Waste', `${environmental.totalWaste.toFixed(1)} kg`, Leaf, '#f97316'],
          ['Average AQI', environmental.averageAqi.toFixed(0), CloudSun, '#8b5cf6'],
          ['Water Quality', `${environmental.averageWater.toFixed(0)} / 100`, Waves, '#0ea5e9'],
        ].map(([label, value, Icon, color]) => <article key={label} className={card}><Icon size={18} style={{ color }} /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color }}>{loading ? '-' : value}</p></article>)}
      </section>

      <article className={card}>
        <h2 className="mb-1 font-bold text-slate-800">Latest waste and recycling by ecological location</h2>
        <p className="mb-4 text-xs text-slate-400">Updates whenever the current reading changes on the Sensors page</p>
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

      <section className={`grid gap-4 ${isSuperAdmin ? '' : 'lg:grid-cols-2'}`}>
        <article className={card}>
          {isSuperAdmin ? <DestinationCarbonRanking destinations={analytics.destinations} loading={loading} /> : (
            <div className="flex min-h-[250px] flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-800">Carbon for assigned location</h2>
                <p className="mt-1 text-xs text-slate-400">{locations[0]?.name || 'Assigned ecological location'} · selected report period</p>
              </div>
              <div className="py-8 text-center">
                <Leaf className="mx-auto text-green-500" size={28} />
                <p className="mt-4 text-4xl font-bold text-slate-900">{loading ? '-' : `${analytics.summary.totalEmission.toFixed(1)} kg`}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Total CO₂ emissions</p>
                <p className="mt-1 text-xs text-slate-400">Calculated from {analytics.summary.totalTrips} recorded trip{analytics.summary.totalTrips === 1 ? '' : 's'}</p>
              </div>
            </div>
          )}
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

function DestinationCarbonRanking({ destinations, loading }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const pageSize = 5
  const needle = query.trim().toLowerCase()
  const filteredDestinations = destinations.filter((destination) => !needle || destination.name.toLowerCase().includes(needle))
  const totalPages = Math.max(1, Math.ceil(filteredDestinations.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleDestinations = filteredDestinations.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const peakEmission = Math.max(...filteredDestinations.map((item) => Number(item.emission) || 0), 0)
  const totalEmission = filteredDestinations.reduce((sum, item) => sum + (Number(item.emission) || 0), 0)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800">Carbon across all destinations</h2>
          <p className="mt-1 text-xs text-slate-400">Ranked by total CO₂ emissions for the selected report period</p>
        </div>
        <div className="rounded-xl bg-green-50 px-3 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">{query ? 'Matching carbon' : 'Combined carbon'}</p>
          <p className="mt-0.5 text-lg font-bold text-green-700">{loading ? '-' : `${totalEmission.toFixed(1)} kg`}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            placeholder="Search destinations"
            aria-label="Search carbon destinations"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500"
          />
        </label>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{filteredDestinations.length} destination{filteredDestinations.length === 1 ? '' : 's'}</span>
          {query && <button type="button" onClick={() => { setQuery(''); setPage(1) }} className="font-semibold text-blue-600 hover:underline">Clear</button>}
        </div>
      </div>

      {filteredDestinations.length ? (
        <div className="mt-6 space-y-4">
          {visibleDestinations.map((destination, index) => {
            const emission = Number(destination.emission) || 0
            const width = peakEmission ? Math.max((emission / peakEmission) * 100, 2) : 0
            const share = totalEmission ? (emission / totalEmission) * 100 : 0
            const rank = (currentPage - 1) * pageSize + index + 1
            return (
              <div key={destination.name}>
                <div className="mb-1.5 flex items-center gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">{rank}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-700" title={destination.name}>{formatDestinationLabel(destination.name, 9999)}</span>
                  <span className="shrink-0 font-bold text-slate-800">{emission.toFixed(1)} kg</span>
                  <span className="w-12 shrink-0 text-right text-xs text-slate-400">{share.toFixed(1)}%</span>
                </div>
                <div className="ml-9 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-600" style={{ width: `${width}%` }} />
                </div>
                <p className="ml-9 mt-1 text-[10px] text-slate-400">{destination.trips} trip{destination.trips === 1 ? '' : 's'}</p>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-400">Page {currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid min-h-[240px] place-items-center rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">{query ? `No destinations match “${query}”.` : 'No destination carbon data matches the current filters.'}</div>
      )}
    </div>
  )
}
