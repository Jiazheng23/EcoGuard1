import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react'
import { getAchievementBadges } from '../services/achievementService'
import AchievementBadgeIcon from './AchievementBadgeIcon'

export default function AchievementBadges({ trips, profile, loading = false, error = '', limit = 6, onShowMore }) {
  const badges = getAchievementBadges(trips, profile)
  const visibleBadges = limit ? badges.slice(0, limit) : badges
  const earnedCount = badges.filter((badge) => badge.earned).length

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-bold text-slate-800">Achievement Badges</h2><p className="mt-1 text-xs text-slate-400">Your milestones from saved EcoGuard trips and profile progress</p></div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{earnedCount} of {badges.length} earned</span>
          {onShowMore && badges.length > visibleBadges.length && <button type="button" onClick={onShowMore} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-50">Show more <ArrowRight size={13} /></button>}
        </div>
      </div>
      {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error}</p></div>}
      {loading ? <div className="grid min-h-28 place-items-center text-sm text-slate-400"><LoaderCircle size={20} className="mb-2 animate-spin" /><span>Loading achievements...</span></div> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{visibleBadges.map((badge) => <div className={`rounded-xl border p-3 text-center transition ${badge.earned ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50 opacity-60'}`} key={badge.id}><AchievementBadgeIcon badge={badge} size={19} className="mx-auto size-10" /><p className="mt-1 text-xs font-semibold text-slate-700">{badge.name}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{badge.progress}</p>{badge.earned && <span className="mt-1 inline-block rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">✓</span>}</div>)}</div>
      )}
    </article>
  )
}
