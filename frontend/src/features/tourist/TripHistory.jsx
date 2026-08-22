import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Car, LoaderCircle, Plus, Train } from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import { formatCarbon, formatTripDate, numberValue, transportLabels } from '../../utils/tripAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function TripHistory({ onNavigate, user }) {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadTrips() {
      if (!user?.id) return

      setLoading(true)
      setErrorMessage('')
      try {
        const data = await listOwnTrips(user.id)
        if (active) setTrips(data)
      } catch (error) {
        if (active) setErrorMessage(error.message || 'Unable to load your trip history.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTrips()
    return () => {
      active = false
    }
  }, [user?.id])

  const totalEmission = trips.reduce((total, trip) => total + numberValue(trip.total_emission), 0)
  const totalPoints = trips.reduce((total, trip) => total + numberValue(trip.eco_points), 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-green-600">Travel records</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Trip History</h1>
          <p className="mt-1 text-sm text-slate-500">Review every saved journey and its environmental impact.</p>
        </div>
        <button onClick={() => onNavigate('carbon')} className="inline-flex items-center gap-2 self-start rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm sm:self-auto">
          <Plus size={16} /> Add trip
        </button>
      </header>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert">
          <AlertCircle className="mt-0.5 shrink-0" size={17} />
          <p>{errorMessage}</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SummaryCard label="Saved trips" value={trips.length} />
        <SummaryCard label="Total emissions" value={`${totalEmission.toFixed(1)} kg CO2`} />
        <SummaryCard label="Eco points" value={totalPoints > 0 ? `+${totalPoints}` : totalPoints} />
      </section>

      <article className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">All trips</h2>
          <button onClick={() => onNavigate('dashboard')} className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <ArrowLeft size={13} /> Dashboard
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-40 place-items-center text-slate-400"><LoaderCircle className="animate-spin" size={24} /></div>
        ) : trips.length ? (
          <div className="space-y-3">
            {trips.map((trip) => <TripRow key={trip.id} trip={trip} />)}
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-xl bg-slate-50 p-5 text-center">
            <div>
              <p className="font-semibold text-slate-700">No saved trips yet</p>
              <p className="mt-1 text-sm text-slate-400">Use the calculator to record your first journey.</p>
            </div>
          </div>
        )}
      </article>
    </div>
  )
}

function TripRow({ trip }) {
  const TripIcon = ['mrt', 'train', 'bus'].includes(trip.transport_mode) ? Train : Car
  const points = numberValue(trip.eco_points)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-nowrap">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-500"><TripIcon size={16} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{trip.starting_location} → {trip.destination}</p>
        <p className="mt-1 text-xs text-slate-400">{formatTripDate(trip.travelled_at, { hour: 'numeric', minute: '2-digit' })} · {transportLabels[trip.transport_mode] || trip.transport_mode || 'Unknown transport'}</p>
      </div>
      <div className="min-w-24 text-left text-xs sm:text-right">
        <b className="text-slate-700">{formatCarbon(trip.carbon_emission)}</b>
        <p className={points >= 0 ? 'text-green-600' : 'text-red-500'}>{points > 0 ? '+' : ''}{points} pts</p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <article className={card}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </article>
  )
}
