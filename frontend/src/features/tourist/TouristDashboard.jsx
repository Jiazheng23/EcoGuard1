import { useEffect, useMemo, useState } from 'react'
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
  Clock3,
  LoaderCircle,
  Map,
  Train,
  TrendingDown,
} from 'lucide-react'
import { listOwnTrips } from '../../services/tripService'
import AchievementBadges from './AchievementBadges'
import { getAchievementBadges } from './achievementBadgeRules'
import {
  formatCarbon,
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

export default function TouristDashboard({ onNavigate, user, profile }) {
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
  const earnedBadges = getAchievementBadges(trips, profile).filter((badge) => badge.earned).length
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-6 text-white shadow-lg shadow-green-600/20 md:flex-row md:items-center">
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

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Eco Score', ecoScore, '/ 100', `${analytics.ecoPoints >= 0 ? '+' : ''}${analytics.ecoPoints} trip points`, 'text-green-500'],
          ["Today's Emission", analytics.todayEmission.toFixed(1), 'kg CO₂', 'From saved trips today', 'text-blue-500'],
          ['Monthly Emission', analytics.monthlyEmission.toFixed(1), 'kg CO₂', 'Current calendar month', 'text-violet-500'],
          ['Badges Earned', earnedBadges, '/ 6', `${6 - earnedBadges} still available`, 'text-amber-500'],
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

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={`${card} flex flex-col items-center justify-center gap-3`}>
          <EcoGauge score={ecoScore} />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              {ecoScore >= 80 ? 'Excellent eco performance' : ecoScore >= 60 ? 'Good — keep improving' : 'Start with a lower-carbon trip'}
            </p>
            <p className="text-xs text-slate-400">Synced from your Supabase profile</p>
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

      <AchievementBadges trips={trips} profile={profile} loading={loading} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <div className="mb-4 flex justify-between">
            <h2 className="font-bold text-slate-800">Recent Trips</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigate('history')} className="flex items-center gap-1 text-xs font-semibold text-slate-500">View history <ArrowRight size={13} /></button>
              <button onClick={() => onNavigate('carbon')} className="flex items-center gap-1 text-xs font-semibold text-green-600">Add trip <ArrowRight size={13} /></button>
            </div>
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
                    <p className={numberValue(trip.eco_points) >= 0 ? 'text-green-600' : 'text-red-500'}>{numberValue(trip.eco_points) > 0 ? '+' : ''}{trip.eco_points} pts</p>
                  </div>
                </div>
              )
            })}
            {!loading && !trips.length && <EmptyState text="No trips yet. Use the calculator to save your first journey." />}
          </div>
        </article>

        <article className={card}>
          <h2 className="mb-4 font-bold text-slate-800">Eco Recommendations</h2>
          <div className="space-y-3">
            {[
              [Train, 'Choose MRT, LRT, or ETS for your next suitable route to reduce per-passenger emissions.', 'text-blue-500'],
              [Car, `${analytics.transport[0]?.name || 'Car trips'} currently represents your most-used recorded mode. Compare alternatives before saving.`, 'text-amber-500'],
              [Clock3, 'Your dashboard and the administrator reports update from the same saved trip records.', 'text-green-500'],
            ].map(([Icon, text, color]) => (
              <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3" key={text}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-white ${color}`}><Icon size={16} /></span>
                <p className="text-sm leading-5 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('carbon')} className="mt-4 w-full rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white">Calculate New Trip</button>
        </article>
      </section>
    </div>
  )
}

function ChartCard({ title, aside, children }) {
  return (
    <article className={card}>
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
