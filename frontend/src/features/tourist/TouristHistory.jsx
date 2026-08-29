import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Award, CalendarDays, ChevronDown, Cloud, Download, History, Leaf, MapPin, Navigation, RefreshCw, Route, Search, Users, X } from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import { formatCarbon, formatTripDate, numberValue, transportLabels } from '../../utils/tripAnalytics'
import { downloadTripHistoryCsv, downloadTripHistoryPdf } from '../../utils/tripReport'

const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm'

export default function TouristHistory({ user }) {
  const [trips, setTrips] = useState([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateMode, setDateMode] = useState('range')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const exportMenuRef = useRef(null)
  const dateFilterRef = useRef(null)

  useEffect(() => {
    let active = true

    async function loadInitialHistory() {
      if (!user?.id) return
      try {
        const rows = await listOwnTrips(user.id)
        if (active) setTrips(rows)
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load your trip history.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadInitialHistory()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    function closeExportMenu(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && (exportMenuRef.current?.contains(event.target) || dateFilterRef.current?.contains(event.target))) return
      setExportMenuOpen(false)
      setDateFilterOpen(false)
    }

    document.addEventListener('pointerdown', closeExportMenu)
    document.addEventListener('keydown', closeExportMenu)
    return () => {
      document.removeEventListener('pointerdown', closeExportMenu)
      document.removeEventListener('keydown', closeExportMenu)
    }
  }, [])

  useEffect(() => {
    if (!selectedTrip) return undefined

    const previousOverflow = document.body.style.overflow
    function closeTripDetails(event) {
      if (event.key === 'Escape') setSelectedTrip(null)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeTripDetails)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeTripDetails)
    }
  }, [selectedTrip])

  async function loadHistory() {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      setTrips(await listOwnTrips(user.id))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your trip history.')
    } finally {
      setLoading(false)
    }
  }

  function downloadHistory(format) {
    if (!filteredTrips.length) return
    setExportMenuOpen(false)
    if (format === 'pdf') downloadTripHistoryPdf(filteredTrips)
    else downloadTripHistoryCsv(filteredTrips)
  }

  const modes = useMemo(
    () => [...new Set(trips.map((trip) => trip.transport_mode).filter(Boolean))].sort(),
    [trips],
  )

  const term = query.trim().toLowerCase()
  const validSelectedYear = /^\d{4}$/.test(selectedYear) && Number(selectedYear) >= 2000 && Number(selectedYear) <= 2100
  const activeDateFrom = dateMode === 'range' ? dateFrom : dateMode === 'month' && selectedMonth ? `${selectedMonth}-01` : dateMode === 'year' && validSelectedYear ? `${selectedYear}-01-01` : ''
  const monthEnd = selectedMonth ? new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate() : null
  const activeDateTo = dateMode === 'range' ? dateTo : dateMode === 'month' && selectedMonth ? `${selectedMonth}-${monthEnd}` : dateMode === 'year' && validSelectedYear ? `${selectedYear}-12-31` : ''
  const fromTime = activeDateFrom ? new Date(`${activeDateFrom}T00:00:00`).getTime() : null
  const toTime = activeDateTo ? new Date(`${activeDateTo}T23:59:59.999`).getTime() : null
  const filteredTrips = trips.filter((trip) => {
    const matchesMode = mode === 'all' || trip.transport_mode === mode
    const matchesQuery = !term || [trip.starting_location, trip.destination, transportLabels[trip.transport_mode], trip.transport_mode]
      .some((value) => String(value || '').toLowerCase().includes(term))
    const travelledTime = new Date(trip.travelled_at).getTime()
    const matchesDate = (!activeDateFrom || travelledTime >= fromTime) && (!activeDateTo || travelledTime <= toTime)
    return matchesMode && matchesQuery && matchesDate
  })

  const invalidDateRange = dateMode === 'range' && Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const exportableTrips = invalidDateRange ? [] : filteredTrips
  const hasDateFilter = Boolean(activeDateFrom || activeDateTo)
  const dateFilterLabel = dateMode === 'month' && selectedMonth
    ? new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : dateMode === 'year' && validSelectedYear
      ? selectedYear
      : dateFrom || dateTo
        ? `${dateFrom || 'Any'} – ${dateTo || 'Any'}`
        : 'Any date'

  function clearDateFilter() {
    setDateFrom('')
    setDateTo('')
    setSelectedMonth('')
    setSelectedYear('')
  }

  const summary = useMemo(() => ({
    distance: trips.reduce((total, trip) => total + numberValue(trip.distance_km), 0),
    emission: trips.reduce((total, trip) => total + numberValue(trip.total_emission), 0),
    points: trips.reduce((total, trip) => total + numberValue(trip.eco_points), 0),
  }), [trips])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trip History</h1>
          <p className="mt-1 text-sm text-slate-500">Review the journeys saved from your carbon calculator.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <div ref={exportMenuRef} className="relative">
            <button type="button" onClick={() => { setDateFilterOpen(false); setExportMenuOpen((open) => !open) }} disabled={loading || !exportableTrips.length} title={!loading && !exportableTrips.length ? 'No matching trip history to download' : `Download ${exportableTrips.length} matching trip${exportableTrips.length === 1 ? '' : 's'}`} aria-haspopup="menu" aria-expanded={exportMenuOpen} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={15} />Download <ChevronDown size={15} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportMenuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-2 min-w-44 overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                <button type="button" role="menuitem" onClick={() => downloadHistory('pdf')} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-green-50 hover:text-green-700">Download PDF</button>
                <button type="button" role="menuitem" onClick={() => downloadHistory('csv')} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-green-50 hover:text-green-700">Download CSV</button>
              </div>
            )}
          </div>
          <button type="button" onClick={loadHistory} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-100 bg-white px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Recorded Trips" value={trips.length} detail="Saved journeys" icon={History} />
        <SummaryCard label="Total Distance" value={`${summary.distance.toFixed(1)} km`} detail="Across all trips" icon={MapPin} />
        <SummaryCard label="Eco Points" value={summary.points.toLocaleString()} detail={`${formatCarbon(summary.emission)} recorded`} icon={Leaf} />
      </section>

      <section className={`${card} relative overflow-visible`}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <label className="relative min-w-0 self-end">
            <span className="sr-only">Search trip history</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search origin, destination, or transport" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-green-500" />
          </label>
          <label className="self-end">
            <span className="sr-only">Filter by transport mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-green-500 sm:w-48">
              <option value="all">All transport</option>
              {modes.map((item) => <option key={item} value={item}>{transportLabels[item] || item}</option>)}
            </select>
          </label>
          <div ref={dateFilterRef} className="relative self-end">
            <button type="button" onClick={() => { setExportMenuOpen(false); setDateFilterOpen((open) => !open) }} aria-haspopup="dialog" aria-expanded={dateFilterOpen} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm outline-none transition ${hasDateFilter ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-700'} hover:border-green-400`}>
              <CalendarDays size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left font-medium">{dateFilterLabel}</span>
              <ChevronDown size={15} className={`shrink-0 transition-transform ${dateFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {dateFilterOpen && (
              <div role="dialog" aria-label="Filter trips by date" className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
                <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                  {['range', 'month', 'year'].map((item) => (
                    <button key={item} type="button" onClick={() => setDateMode(item)} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${dateMode === item ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{item}</button>
                  ))}
                </div>
                <div className="mt-4">
                  {dateMode === 'range' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label><span className="mb-1 block text-xs font-semibold text-slate-500">From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500" /></label>
                      <label><span className="mb-1 block text-xs font-semibold text-slate-500">To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500" /></label>
                    </div>
                  ) : dateMode === 'month' ? (
                    <label><span className="mb-1 block text-xs font-semibold text-slate-500">Choose month</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500" /></label>
                  ) : (
                    <label><span className="mb-1 block text-xs font-semibold text-slate-500">Choose year</span><input type="number" min="2000" max="2100" step="1" placeholder="e.g. 2026" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500" /></label>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button type="button" onClick={clearDateFilter} disabled={!hasDateFilter} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40"><X size={13} /> Clear</button>
                  <button type="button" onClick={() => setDateFilterOpen(false)} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {invalidDateRange && <p className="mx-4 mt-4 text-sm font-medium text-red-600" role="alert">The from date must be on or before the to date.</p>}

        {error ? (
          <div className="m-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error}</p></div>
        ) : loading ? (
          <div className="grid min-h-56 place-items-center text-sm text-slate-400">Loading trip history...</div>
        ) : invalidDateRange || filteredTrips.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center"><div><History className="mx-auto text-slate-300" size={34} /><p className="mt-3 font-semibold text-slate-700">No matching trips</p><p className="mt-1 text-sm text-slate-400">Saved carbon-calculator trips will appear here.</p></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Journey</th><th className="px-5 py-3 font-semibold">Transport</th><th className="px-5 py-3 font-semibold">Distance</th><th className="px-5 py-3 font-semibold">Emission</th><th className="px-5 py-3 text-right font-semibold">Points</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} role="button" tabIndex={0} aria-label={`View trip from ${trip.starting_location} to ${trip.destination}`} onClick={() => setSelectedTrip(trip)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTrip(trip) } }} className="cursor-pointer text-slate-600 transition hover:bg-green-50/60 focus-visible:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-green-500">
                    <td className="whitespace-nowrap px-5 py-4"><span className="inline-flex items-center gap-2"><CalendarDays size={15} className="text-slate-400" />{formatTripDate(trip.travelled_at)}</span></td>
                    <td className="px-5 py-4"><p className="font-semibold text-slate-800">{trip.destination}</p><p className="mt-0.5 max-w-64 truncate text-xs text-slate-400">From {trip.starting_location}{trip.round_trip ? ' · Round trip' : ''}</p></td>
                    <td className="px-5 py-4"><span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">{transportLabels[trip.transport_mode] || trip.transport_mode}</span></td>
                    <td className="whitespace-nowrap px-5 py-4">{numberValue(trip.distance_km).toFixed(1)} km</td>
                    <td className="whitespace-nowrap px-5 py-4">{formatCarbon(trip.total_emission)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-green-700">+{numberValue(trip.eco_points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedTrip && <TripDetailsModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />}
    </div>
  )
}

function TripDetailsModal({ trip, onClose }) {
  const transport = transportLabels[trip.transport_mode] || trip.transport_mode || 'Unknown transport'
  const hasOriginCoordinates = trip.origin_lat != null && trip.origin_lng != null
  const hasDestinationCoordinates = trip.destination_lat != null && trip.destination_lng != null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="trip-details-title" className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-green-600 to-emerald-500 px-5 py-3.5 text-white">
          <button type="button" onClick={onClose} aria-label="Close trip details" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/15 transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X size={16} /></button>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-100">Trip details</p>
          <h2 id="trip-details-title" className="mt-1 text-lg font-bold">{transport} · {trip.round_trip ? 'Round trip' : 'One way'}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-green-50"><CalendarDays size={13} />{formatTripDate(trip.travelled_at, { hour: 'numeric', minute: '2-digit' })}</p>
        </header>

        <div className="space-y-3 p-4">
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Journey</h3>
            <div className="relative rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="absolute bottom-7 left-[1.15rem] top-7 border-l-2 border-dashed border-green-200" />
              <LocationPoint label="Starting point" value={trip.starting_location} />
              <div className="mt-2"><LocationPoint label="Destination" value={trip.destination} destination /></div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Travel information</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DetailItem icon={Navigation} label="Transport" value={transport} />
              <DetailItem icon={Route} label="Trip type" value={trip.round_trip ? 'Round trip' : 'One way'} />
              <DetailItem icon={MapPin} label="Total distance" value={`${numberValue(trip.distance_km).toFixed(1)} km`} />
              <DetailItem icon={Users} label="Passengers" value={numberValue(trip.passengers).toLocaleString()} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Environmental impact</h3>
            <div className="grid grid-cols-3 gap-2">
              <DetailItem icon={Cloud} label="Base emission" value={formatCarbon(trip.carbon_emission)} tone="slate" />
              <DetailItem icon={Leaf} label="Total emission" value={formatCarbon(trip.total_emission)} tone="green" />
              <DetailItem icon={Award} label="Eco points" value={`+${numberValue(trip.eco_points).toLocaleString()}`} tone="green" />
            </div>
          </section>

          {(hasOriginCoordinates || hasDestinationCoordinates) && (
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Location coordinates</h3>
              <div className="grid grid-cols-2 gap-2">
                {hasOriginCoordinates && <CoordinateItem label="Starting coordinates" value={`${Number(trip.origin_lat).toFixed(5)}, ${Number(trip.origin_lng).toFixed(5)}`} />}
                {hasDestinationCoordinates && <CoordinateItem label="Destination coordinates" value={`${Number(trip.destination_lat).toFixed(5)}, ${Number(trip.destination_lng).toFixed(5)}`} />}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function LocationPoint({ label, value, destination = false }) {
  return <div className="relative z-10 flex items-start gap-2.5"><span className={`mt-1 size-2.5 shrink-0 rounded-full border-2 border-white ring-2 ${destination ? 'bg-emerald-600 ring-emerald-200' : 'bg-green-400 ring-green-100'}`} /><div><p className="text-[10px] font-semibold text-slate-400">{label}</p><p className="mt-0.5 text-sm font-semibold leading-snug text-slate-800">{value || 'Not recorded'}</p></div></div>
}

function DetailItem({ icon: Icon, label, value, tone = 'slate' }) {
  const green = tone === 'green'
  return <div className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 ${green ? 'border-green-100 bg-green-50' : 'border-slate-100 bg-slate-50'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${green ? 'bg-white text-green-600' : 'bg-white text-slate-500'}`}><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-slate-400">{label}</p><p className={`mt-0.5 break-words text-xs font-bold leading-snug ${green ? 'text-green-700' : 'text-slate-800'}`}>{value}</p></div></div>
}

function CoordinateItem({ label, value }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><MapPin size={13} className="shrink-0 text-slate-400" /><div className="min-w-0"><p className="text-[9px] font-medium text-slate-400">{label}</p><p className="truncate text-[11px] font-semibold text-slate-700">{value}</p></div></div>
}

function SummaryCard({ label, value, detail, icon: Icon }) {
  return <article className={`${card} flex items-start gap-4 p-4`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-600"><Icon size={18} /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 truncate text-xl font-bold text-slate-800">{value}</p><p className="mt-0.5 truncate text-xs text-slate-400">{detail}</p></div></article>
}
