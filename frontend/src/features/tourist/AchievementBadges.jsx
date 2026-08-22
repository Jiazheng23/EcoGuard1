import { AlertCircle, LoaderCircle } from 'lucide-react'
import { getAchievementBadges } from './achievementBadgeRules'

export default function AchievementBadges({ trips, profile, loading = false, error = '' }) {
  const badges = getAchievementBadges(trips, profile)
  const earnedCount = badges.filter((badge) => badge.earned).length

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-800">Achievement Badges</h2>
          <p className="mt-1 text-xs text-slate-400">Your milestones from saved EcoGuard trips and profile progress</p>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{earnedCount} of {badges.length} earned</span>
      </div>

      {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{error}</p></div>}

      {loading ? (
        <div className="grid min-h-28 place-items-center text-sm text-slate-400"><LoaderCircle size={20} className="mb-2 animate-spin" /><span>Loading achievements...</span></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((badge) => (
            <div className={`rounded-xl border p-3 text-center transition ${badge.earned ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50 opacity-60'}`} key={badge.name}>
              <span className="text-2xl" aria-hidden="true">{badge.icon}</span>
              <p className="mt-1 text-xs font-semibold text-slate-700">{badge.name}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{badge.progress}</p>
              {badge.earned && <span className="mt-1 inline-block rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">✓</span>}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
