import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Award, Check, LoaderCircle, MapPin, Route, Sparkles, Ticket, Wind, Zap } from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import { numberValue } from '../../utils/tripAnalytics'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

function getProgress(trips, profile) {
  const activeDays = new Set(trips.map((trip) => new Date(trip.travelled_at).toISOString().slice(0, 10))).size
  const publicTransportTrips = trips.filter((trip) => ['bus', 'mrt', 'train'].includes(trip.transport_mode)).length
  const zeroEmissionTrips = trips.filter((trip) => ['walking', 'bicycle'].includes(trip.transport_mode)).length
  const destinations = new Set(trips.map((trip) => trip.destination?.trim()).filter(Boolean)).size

  return [
    Math.min(trips.length, 1),
    Math.min(publicTransportTrips, 5),
    Math.min(zeroEmissionTrips, 3),
    Math.min(numberValue(profile?.total_carbon_saved), 5),
    Math.min(activeDays, 7),
    Math.min(destinations, 5),
  ]
}

export default function AchievementBadges({ onNavigate, user, profile }) {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function loadTrips() {
      if (!user?.id) return
      try {
        const data = await listOwnTrips(user.id)
        if (active) setTrips(data)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTrips()
    return () => { active = false }
  }, [user?.id])

  const progress = useMemo(() => getProgress(trips, profile), [profile, trips])
  const badges = [
    ['first-trip', 'Green Traveler', 'Save your first journey in EcoGuard.', Route, 'bg-green-50 text-green-600', 1],
    ['public-transport', 'Public Transport Champion', 'Complete 5 bus, MRT, LRT, or train trips.', Ticket, 'bg-blue-50 text-blue-600', 5],
    ['zero-emission', 'Zero-Emission Explorer', 'Complete 3 walking or bicycle trips.', Sparkles, 'bg-sky-50 text-sky-600', 3],
    ['carbon-saver', 'Carbon Saver', 'Save 5 kg of carbon through greener choices.', Wind, 'bg-emerald-50 text-emerald-600', 5],
    ['consistent-traveler', 'Consistent Traveler', 'Record trips on 7 different days.', Zap, 'bg-orange-50 text-orange-600', 7],
    ['destination-explorer', 'Eco Destination Explorer', 'Record trips to 5 different destinations.', MapPin, 'bg-teal-50 text-teal-600', 5],
  ]
  const earnedCount = progress.filter((value, index) => value >= badges[index][5]).length

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-green-600">Progress rewards</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Achievement Badges</h1>
          <p className="mt-1 text-sm text-slate-500">Complete helpful travel challenges and claim something useful.</p>
        </div>
        <button onClick={() => onNavigate('dashboard')} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 sm:self-auto"><ArrowLeft size={16} /> Dashboard</button>
      </header>

      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-6 text-white shadow-lg shadow-green-600/20 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold text-white/80">Your collection</p><p className="mt-1 text-4xl font-bold">{loading ? <LoaderCircle className="animate-spin" size={32} /> : `${earnedCount} / ${badges.length}`}</p><p className="mt-1 text-sm text-white/80">completed challenges ready to turn into rewards</p></div>
        <Award size={70} strokeWidth={1.2} className="hidden text-white/70 sm:block" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map(([id, name, description, Icon, color, target], index) => {
          const current = progress[index]
          const isEarned = current >= target
          return (
            <article className={`${card} ${isEarned ? 'border-amber-200' : ''}`} key={id}>
              <div className="flex items-start justify-between gap-3"><span className={`grid size-12 place-items-center rounded-2xl ${color} ${isEarned ? '' : 'grayscale opacity-50'}`}><Icon size={24} /></span>{isEarned && <span className="grid size-6 place-items-center rounded-full bg-green-500 text-white"><Check size={14} strokeWidth={3} /></span>}</div>
              <h2 className="mt-4 font-bold text-slate-800">{name}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Progress</span><span>{current} / {target}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(current / target) * 100}%` }} /></div></div>
              <p className={`mt-4 text-xs font-bold uppercase tracking-wider ${isEarned ? 'text-green-600' : 'text-slate-400'}`}>{isEarned ? 'Completed' : 'Keep going'}</p>
            </article>
          )
        })}
      </section>
    </div>
  )
}
