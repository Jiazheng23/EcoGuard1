import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, History, Leaf, MapPin, RefreshCw, Search } from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import { formatCarbon, formatTripDate, numberValue, transportLabels } from '../../utils/tripAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white shadow-sm'

export default function TouristHistory({ user }) {
  const [trips, setTrips] = useState([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const modes = useMemo(
    () => [...new Set(trips.map((trip) => trip.transport_mode).filter(Boolean))].sort(),
    [trips],
  )

  const filteredTrips = useMemo(() => {
    const term = query.trim().toLowerCase()
    return trips.filter((trip) => {
      const matchesMode = mode === 'all' || trip.transport_mode === mode
      const matchesQuery = !term || [trip.starting_location, trip.destination, transportLabels[trip.transport_mode], trip.transport_mode]
        .some((value) => String(value || '').toLowerCase().includes(term))
      return matchesMode && matchesQuery
    })
  }, [mode, query, trips])

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
        <button type="button" onClick={loadHistory} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-green-100 bg-white px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Recorded Trips" value={trips.length} detail="Saved journeys" icon={History} />
        <SummaryCard label="Total Distance" value={`${summary.distance.toFixed(1)} km`} detail="Across all trips" icon={MapPin} />
        <SummaryCard label="Eco Points" value={summary.points.toLocaleString()} detail={`${formatCarbon(summary.emission)} recorded`} icon={Leaf} />
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search trip history</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search origin, destination, or transport" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-green-500" />
          </label>
          <label>
            <span className="sr-only">Filter by transport mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-green-500 sm:w-48">
              <option value="all">All transport</option>
              {modes.map((item) => <option key={item} value={item}>{transportLabels[item] || item}</option>)}
            </select>
          </label>
        </div>

        {error ? (
          <div className="m-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error}</p></div>
        ) : loading ? (
          <div className="grid min-h-56 place-items-center text-sm text-slate-400">Loading trip history...</div>
        ) : filteredTrips.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center"><div><History className="mx-auto text-slate-300" size={34} /><p className="mt-3 font-semibold text-slate-700">No matching trips</p><p className="mt-1 text-sm text-slate-400">Saved carbon-calculator trips will appear here.</p></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Journey</th><th className="px-5 py-3 font-semibold">Transport</th><th className="px-5 py-3 font-semibold">Distance</th><th className="px-5 py-3 font-semibold">Emission</th><th className="px-5 py-3 text-right font-semibold">Points</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="text-slate-600 transition hover:bg-slate-50/70">
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
    </div>
  )
}

function SummaryCard({ label, value, detail, icon: Icon }) {
  return <article className={`${card} flex items-start gap-4 p-4`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-600"><Icon size={18} /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 truncate text-xl font-bold text-slate-800">{value}</p><p className="mt-0.5 truncate text-xs text-slate-400">{detail}</p></div></article>
}
