import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CloudSun,
  Droplets,
  MapPin,
  Recycle,
  Route,
  ThermometerSun,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react'
import { latestMetricsByLocation } from '../../services/locationService'
import {
  airQualityLabel,
  sensorReadingSummary,
  waterQualityLabel,
} from '../../utils/sensorMetrics'
import {
  formatCarbon,
  formatTripDate,
  getDestinationSeries,
  getMonthlySeries,
  getTripSummary,
  numberValue,
} from '../../utils/tripAnalytics'

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '0.75rem',
}

export default function AdminDashboard({
  onNavigate,
  profiles,
  trips,
  locations = [],
  metrics = [],
  loading,
  error,
  isSuperAdmin,
  selectedSensorLocationId,
  onSensorLocationChange,
}) {
  const data = useMemo(() => {
    const summary = getTripSummary(trips, profiles)
    const monthly = getMonthlySeries(trips)
    const destinations = getDestinationSeries(trips)
    const highCarbonTrips = [...trips]
      .filter((trip) => numberValue(trip.carbon_emission) > 15)
      .sort((left, right) => new Date(right.travelled_at) - new Date(left.travelled_at))
      .slice(0, 4)
    const recordedTourists = new Set(
      trips.map((trip) => trip.tourist_id).filter(Boolean),
    ).size

    return { summary, monthly, destinations, highCarbonTrips, recordedTourists }
  }, [profiles, trips])

  const latestMetrics = useMemo(() => latestMetricsByLocation(metrics), [metrics])
  const selectedSensorLocation = locations.find(
    (location) => String(location.id) === String(selectedSensorLocationId),
  ) || locations[0] || null
  const selectedSensorReading = selectedSensorLocation
    ? latestMetrics[String(selectedSensorLocation.id)]
    : null
  const sensor = sensorReadingSummary(selectedSensorLocation, selectedSensorReading)

  const kpis = [
    {
      label: isSuperAdmin ? 'Registered Tourists' : 'Tourists at Location',
      value: isSuperAdmin ? data.summary.touristCount : data.recordedTourists,
      delta: isSuperAdmin ? `${profiles.length} total profiles` : `${data.summary.totalTrips} trips to this location`,
      color: '#3b82f6',
      icon: Users,
      page: 'reports',
    },
    { label: 'Recorded Destinations', value: data.summary.destinationCount, delta: `${data.summary.totalTrips} saved trips`, color: '#22c55e', icon: MapPin, page: 'locations' },
    { label: 'High Carbon Trips', value: data.summary.highEmissionTrips, delta: 'Above 15 kg per passenger', color: '#ef4444', icon: AlertTriangle, page: 'thresholds' },
    { label: 'Avg Carbon/Trip', value: `${data.summary.averageEmission.toFixed(1)} kg`, delta: `${data.summary.totalEmission.toFixed(1)} kg total`, color: '#8b5cf6', icon: TrendingDown, page: 'reports' },
  ]

  const environmentalKpis = [
    { label: 'Visitors', value: sensor.visitors.toLocaleString(), delta: `${sensor.occupancyPercent.toFixed(1)}% of ${sensor.capacity.toLocaleString()} capacity`, color: '#3b82f6', icon: Activity },
    { label: 'Waste', value: `${sensor.waste.toFixed(2)} kg`, delta: 'Current detected level', color: '#f97316', icon: Trash2 },
    { label: 'Recyclable material', value: `${sensor.recyclable.toFixed(2)} kg`, delta: `${sensor.recyclablePercent.toFixed(1)}% of waste`, color: '#22c55e', icon: Recycle },
    { label: 'Air quality index', value: sensor.airQualityIndex, delta: airQualityLabel(sensor.airQualityIndex), color: '#8b5cf6', icon: CloudSun },
    { label: 'Water quality', value: `${sensor.waterQualityScore.toFixed(1)} / 100`, delta: waterQualityLabel(sensor.waterQualityScore), color: '#06b6d4', icon: Droplets },
    { label: 'Temperature', value: sensor.temperatureC == null ? 'Unavailable' : `${sensor.temperatureC.toFixed(1)} °C`, delta: 'Current sensor temperature', color: '#ef4444', icon: ThermometerSun },
  ]

  const lowImpact = trips.filter((trip) => numberValue(trip.carbon_emission) <= 5).length
  const moderateImpact = trips.filter((trip) => numberValue(trip.carbon_emission) > 5 && numberValue(trip.carbon_emission) <= 15).length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{isSuperAdmin ? 'Admin Dashboard' : 'Location Dashboard'}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isSuperAdmin
              ? 'Live system overview · profiles, trips, and sensor readings'
              : `${selectedSensorLocation?.name || 'Assigned location'} overview · trips and sensor readings`}
          </p>
        </div>
      </header>

      {error && <DataError message={error} />}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, delta, color, icon: Icon, page }) => (
          <button key={label} type="button" onClick={() => onNavigate(page)} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <span className="grid size-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}15` }}><Icon size={16} style={{ color }} /></span>
            </div>
            <strong className="text-2xl leading-none" style={{ color }}>{loading ? '—' : value}</strong>
            <span className="text-xs text-slate-400">{delta}</span>
          </button>
        ))}
      </section>

      <section aria-labelledby="environmental-overview-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="environmental-overview-heading" className="font-bold text-slate-900">Environmental Monitoring</h2>
            <p className="mt-0.5 text-xs text-slate-400">The same current reading shown on the Sensors page</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {selectedSensorLocation && isSuperAdmin && locations.length > 1 ? (
              <label className="min-w-56 text-xs font-semibold text-slate-500">
                Location
                <select
                  aria-label="Dashboard sensor location"
                  value={selectedSensorLocation.id}
                  onChange={(event) => onSensorLocationChange?.(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </label>
            ) : selectedSensorLocation ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><MapPin size={14} className="text-blue-500" />{selectedSensorLocation.name}</span>
            ) : null}
            <span className="pb-2 text-xs font-medium text-slate-400">Every 5 minutes{sensor.recordedAt ? ` · Updated ${formatMetricDate(sensor.recordedAt)}` : ''}</span>
          </div>
        </div>
        {selectedSensorReading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {environmentalKpis.map(({ label, value, delta, color, icon: Icon }) => (
              <button key={label} type="button" onClick={() => onNavigate('sensors')} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                  <span className="grid size-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}15` }}><Icon size={16} style={{ color }} /></span>
                </div>
                <strong className="text-2xl leading-none" style={{ color }}>{loading ? '—' : value}</strong>
                <span className="text-xs text-slate-400">{delta}</span>
              </button>
            ))}
          </div>
        ) : !loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No sensor reading is available for this location yet.</div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Trip & Carbon Trend</h2>
            <span className="text-xs text-slate-400">Last 7 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthly} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs><linearGradient id="admin-emission" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area isAnimationActive={false} type="monotone" dataKey="emission" name="Carbon (kg)" stroke="#3b82f6" strokeWidth={2.5} fill="url(#admin-emission)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">High Carbon Activity</h2>
            <button type="button" onClick={() => onNavigate('thresholds')} className="text-xs font-semibold text-blue-600 hover:underline">View all</button>
          </div>
          <div className="flex flex-col gap-3">
            {data.highCarbonTrips.map((trip) => (
              <div key={trip.id} className="flex items-start gap-3 rounded-xl bg-red-50 p-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{trip.destination}</p>
                  <p className="text-xs text-slate-500">{formatCarbon(trip.carbon_emission)} · {trip.transport_mode}</p>
                  <p className="mt-0.5 text-xs text-red-500">{formatTripDate(trip.travelled_at)}</p>
                </div>
              </div>
            ))}
            {!data.highCarbonTrips.length && <p className="grid min-h-36 place-items-center rounded-xl bg-green-50 p-4 text-center text-sm text-green-700">No trips above the 15 kg caution level.</p>}
          </div>
        </ChartCard>
      </section>

      <ChartCard>
        <h2 className="mb-4 font-bold text-slate-900">Carbon Emission by Destination</h2>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data.destinations.slice(0, 8)} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} kg CO₂`, 'Carbon']} />
            <Bar isAnimationActive={false} dataKey="emission" fill="#3b82f6" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Low-impact trips', lowImpact, trips.length, '#22c55e', CheckCircle],
          ['Moderate trips', moderateImpact, trips.length, '#f59e0b', Route],
          ['High-impact trips', data.summary.highEmissionTrips, trips.length, '#ef4444', AlertTriangle],
          isSuperAdmin
            ? ['Profiles synced', profiles.length, profiles.length, '#8b5cf6', Users]
            : ['Tourists recorded', data.recordedTourists, data.recordedTourists, '#8b5cf6', Users],
        ].map(([label, value, total, color, Icon]) => (
          <article key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2"><Icon size={14} style={{ color }} /><p className="text-xs text-slate-500">{label}</p></div>
            <p className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</p>
            <p className="mt-1 text-xs text-slate-400">of {total}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

function ChartCard({ className = '', children }) {
  return <article className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>{children}</article>
}

function DataError({ message }) {
  return <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={17} /><p>{message}</p></div>
}

function formatMetricDate(timestamp) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}
