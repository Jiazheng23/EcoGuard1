import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Car,
  CheckCircle2,
  LoaderCircle,
  Map,
  Sparkles,
  Train,
  TrendingDown,
} from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import AchievementBadges from '../../components/AchievementBadges'
import LoadingScreen from '../../components/LoadingScreen'
import { getAchievementBadges } from '../../services/achievementService'
import { getEcoRecommendations } from '../../utils/ecoRecommendations'
import {
  formatCarbon,
  formatEcoPoints,
  formatTripDate,
  getDailySeries,
  getMonthlySeries,
  getTransportSeries,
  numberValue,
  transportLabels,
} from '../../utils/tripAnalytics'

const chartStyle = { fontSize: 11, fill: '#94a3b8' }
const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

function EcoGauge({ score }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0))

  return (
    <div className="relative grid size-[120px] place-items-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safeScore / 100)}
        />
      </svg>
      <div className="absolute text-center">
        <b className="block text-3xl leading-none text-green-500">{safeScore}</b>
        <span className="text-[9px] font-bold tracking-widest text-slate-500">ECO SCORE</span>
      </div>
    </div>
  )
}

export default function TouristDashboard({
  onNavigate,
  user,
  profile,
  successMessage = '',
  onDismissMessage,
}) {
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
        if (active) setErrorMessage(error.message || 'Unable to load your trips.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTrips()
    return () => {
      active = false
    }
  }, [user?.id])

  const analytics = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const month = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayEmission = trips
      .filter((trip) => new Date(trip.travelled_at) >= today)
      .reduce((total, trip) => total + numberValue(trip.total_emission), 0)
    const monthlyEmission = trips
      .filter((trip) => new Date(trip.travelled_at) >= month)
      .reduce((total, trip) => total + numberValue(trip.total_emission), 0)
    const ecoPoints = trips.reduce(
      (total, trip) => total + numberValue(trip.eco_points),
      0,
    )

    return {
      todayEmission,
      monthlyEmission,
      ecoPoints,
      monthly: getMonthlySeries(trips),
      weekly: getDailySeries(trips),
      transport: getTransportSeries(trips),
    }
  }, [trips])

  const fullName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Tourist'
  const ecoScore = profile?.eco_score ?? 50
  const savedCarbon = numberValue(profile?.total_carbon_saved)
  const achievementBadges = getAchievementBadges(trips, profile)
  const earnedBadges = achievementBadges.filter((badge) => badge.earned).length
  const ecoRecommendations = useMemo(() => getEcoRecommendations(trips), [trips])
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return <LoadingScreen label="Loading your dashboard..." />
  }

  return (
    <div className="tourist-dashboard-page mx-auto flex max-w-6xl flex-col gap-5">
      {successMessage && createPortal(
        <div
          className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) onDismissMessage() }}
        >
          <section
            className="w-full max-w-md rounded-3xl border border-green-100 bg-white p-7 text-center shadow-2xl shadow-slate-900/20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-save-success-title"
            aria-describedby="trip-save-success-description"
          >
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-green-50 text-green-500">
              <CheckCircle2 size={34} strokeWidth={2.25} />
            </span>
            <h2 id="trip-save-success-title" className="mt-5 text-xl font-bold text-slate-900">
              Trip saved successfully
            </h2>
            <p id="trip-save-success-description" className="mt-2 text-sm text-slate-500">
              {successMessage}
            </p>
            <button
              type="button"
              onClick={onDismissMessage}
              className="mt-6 w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-100"
            >
              OK
            </button>
          </section>
        </div>
      , document.body)}

      <section className="tourist-dashboard-hero flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-6 text-white shadow-lg shadow-green-600/20 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-white/75">{greeting}, 👋</p>
          <h1 className="mt-1 text-2xl font-bold">{fullName}</h1>
          <p className="mt-1 text-xs text-white/70">{user?.email}</p>
          <p className="mt-1 text-sm text-white/75">
            You have saved {savedCarbon.toFixed(1)} kg CO₂ across {trips.length} recorded trip{trips.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onNavigate('carbon')} className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold">
            <Calculator size={16} /> Calculate Trip
          </button>
          <button onClick={() => onNavigate('monitoring')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-green-700">
            <Map size={16} /> Eco Map
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert">
          <AlertCircle className="mt-0.5 shrink-0" size={17} />
          <p>{errorMessage}</p>
        </div>
      )}

      <section className="tourist-dashboard-stats grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Eco Score', ecoScore, '/ 100', `${formatEcoPoints(analytics.ecoPoints)} pts from recorded trips`, 'text-green-500'],
          ["Today's Emission", analytics.todayEmission.toFixed(1), 'kg CO₂', 'From saved trips today', 'text-blue-500'],
          ['Monthly Emission', analytics.monthlyEmission.toFixed(1), 'kg CO₂', 'Current calendar month', 'text-violet-500'],
          ['Badges Earned', earnedBadges, `/ ${achievementBadges.length}`, `${achievementBadges.length - earnedBadges} still available`, 'text-amber-500'],
        ].map(([label, value, unit, delta, color]) => (
          <article className={card} key={label}>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>
              {loading ? <LoaderCircle className="animate-spin" size={24} /> : value}
              {!loading && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <TrendingDown size={13} /> {delta}
            </p>
          </article>
        ))}
      </section>

      <section className="tourist-impact-grid grid gap-4 lg:grid-cols-3">
        <article className={`${card} flex flex-col items-center justify-center gap-3`}>
          <EcoGauge score={ecoScore} />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              {ecoScore >= 80 ? 'Excellent eco performance，please keep it up!' : ecoScore >= 60 ? 'Good — keep improving' : 'Start with a lower-carbon trip'}
            </p>
          </div>
        </article>

        <ChartCard title="Monthly Emission History">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.monthly} margin={{ left: -22 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={chartStyle} axisLine={false} tickLine={false} />
              <YAxis tick={chartStyle} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`${value} kg CO₂`, 'Emission']} />
              <Bar dataKey="emission" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transport Usage">
          {analytics.transport.length ? (
            <>
              <div className="h-[138px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.transport} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={3} isAnimationActive={false}>
                      {analytics.transport.map((item) => <Cell key={item.mode} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} trips`, 'Usage']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {analytics.transport.slice(0, 4).map((item) => (
                  <p className="flex justify-between text-xs text-slate-500" key={item.mode}>
                    <span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: item.color }} />{item.name}</span>
                    <b className="text-slate-700">{item.trips}</b>
                  </p>
                ))}
              </div>
            </>
          ) : <EmptyState text="Save a trip to see your transport mix." />}
        </ChartCard>
      </section>

      <ChartCard title="Weekly Carbon Trend" aside="kg CO₂ / day">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={analytics.weekly} margin={{ left: -20 }}>
            <defs><linearGradient id="green-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity=".25" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={chartStyle} axisLine={false} tickLine={false} />
            <YAxis tick={chartStyle} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [`${value} kg CO₂`, 'Emission']} />
            <Area type="monotone" dataKey="emission" stroke="#22c55e" strokeWidth={2.5} fill="url(#green-area)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <AchievementBadges trips={trips} profile={profile} loading={loading} onShowMore={() => onNavigate('achievements')} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <div className="mb-4 flex justify-between">
            <h2 className="font-bold text-slate-800">Recent Trips</h2>
            <button onClick={() => onNavigate('history')} className="flex items-center gap-1 text-xs font-semibold text-slate-500">View history <ArrowRight size={13} /></button>
          </div>
          <div className="space-y-3">
            {trips.slice(0, 4).map((trip) => {
              const TrainIcon = ['mrt', 'train', 'bus'].includes(trip.transport_mode) ? Train : Car
              return (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={trip.id}>
                  <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-500"><TrainIcon size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{trip.starting_location} → {trip.destination}</p>
                    <p className="text-xs text-slate-400">{formatTripDate(trip.travelled_at)} · {transportLabels[trip.transport_mode] || trip.transport_mode}</p>
                  </div>
                  <div className="text-right text-xs">
                    <b className="text-slate-700">{formatCarbon(trip.carbon_emission)}</b>
                    <p className={numberValue(trip.eco_points) >= 0 ? 'text-green-600' : 'text-red-500'}>{formatEcoPoints(trip.eco_points)} pts</p>
                  </div>
                </div>
              )
            })}
            {!loading && !trips.length && <EmptyState text="No trips yet. Use the calculator to save your first journey." />}
          </div>
        </article>

        <article className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-sm">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                <Sparkles size={15} />
              </span>
              <h2 className="font-bold text-slate-900">Eco Recommendations</h2>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              {trips.length} recorded trip{trips.length === 1 ? '' : 's'}
            </span>
          </header>

          <div className="space-y-3">
            {ecoRecommendations.map((recommendation, index) => (
              <section
                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm ${index === 0
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : 'border-slate-100 bg-white/90'
                }`}
                key={recommendation.id}
              >
                {index === 0 && <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden="true" />}
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm ${recommendation.tone}`}>
                  <RecommendationIcon type={recommendation.type} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white">
                        Best
                      </span>
                    )}
                    <h3 className="truncate text-sm font-bold text-slate-800">{recommendation.title}</h3>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{recommendation.summary}</p>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  {recommendation.metrics.map((metric) => (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700" key={metric}>
                      {metric}
                    </span>
                  ))}
                </div>
              </section>
            ))}

            <button
              onClick={() => onNavigate('carbon')}
              className="group mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              Calculate New Trip
              <ArrowRight className="transition group-hover:translate-x-1" size={15} />
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}

function ChartCard({ title, aside, children }) {
  return (
    <article className={`${card} tourist-chart-card`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">{title}</h2>
        {aside && <span className="text-xs text-slate-400">{aside}</span>}
      </div>
      {children}
    </article>
  )
}

function EmptyState({ text }) {
  return <p className="grid min-h-28 place-items-center rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">{text}</p>
}

function RecommendationIcon({ type, size }) {
  if (type === 'transport') return <Car size={size} />
  if (type === 'route') return <Map size={size} />
  if (type === 'trend') return <TrendingDown size={size} />
  if (type === 'start') return <Calculator size={size} />
  return <CheckCircle2 size={size} />
}
