import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Award, Check, LoaderCircle } from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import AchievementBadgeIcon from '../../components/AchievementBadgeIcon'
import { getAchievementBadges } from '../../services/achievementService'

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function TouristAchievements({ user, profile }) {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadTrips() {
      if (!user?.id) return
      try {
        const data = await listOwnTrips(user.id)
        if (active) setTrips(data)
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load your achievements.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadTrips()
    return () => { active = false }
  }, [user?.id])

  const badges = useMemo(() => getAchievementBadges(trips, profile), [profile, trips])
  const earnedCount = badges.filter((badge) => badge.earned).length

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-green-600">Progress rewards</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Achievement Badges</h1>
          <p className="mt-1 text-sm text-slate-500">Complete helpful travel challenges and claim something useful.</p>
        </div>
      </header>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={17} /><p>{error}</p></div>}

      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-6 text-white shadow-lg shadow-green-600/20 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold text-white/80">Your collection</p><p className="mt-1 text-4xl font-bold">{loading ? <LoaderCircle className="animate-spin" size={32} /> : `${earnedCount} / ${badges.length}`}</p><p className="mt-1 text-sm text-white/80">completed challenges ready to turn into rewards</p></div>
        <Award size={70} strokeWidth={1.2} className="hidden text-white/70 sm:block" />
      </section>

      <section className="tourist-achievement-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => {
          return (
            <article className={`${card} ${badge.earned ? 'border-amber-200' : ''}`} key={badge.id}>
              <div className="flex items-start justify-between gap-3"><AchievementBadgeIcon badge={badge} size={24} className={badge.earned ? 'size-12' : 'size-12 grayscale opacity-50'} />{badge.earned && <span className="grid size-6 place-items-center rounded-full bg-green-500 text-white"><Check size={14} strokeWidth={3} /></span>}</div>
              <h2 className="mt-4 font-bold text-slate-800">{badge.name}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{badge.description}</p>
              <div className="mt-4"><div className="mb-1 flex justify-between gap-2 text-xs font-semibold text-slate-500"><span>Progress</span><span className="text-right">{badge.progress}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${badge.progressPercent}%` }} /></div></div>
              <p className={`mt-4 text-xs font-bold uppercase tracking-wider ${badge.earned ? 'text-green-600' : 'text-slate-400'}`}>{badge.earned ? 'Completed' : 'Keep going'}</p>
            </article>
          )
        })}
      </section>
    </div>
  )
}
