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
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'

const visitorTrend = [
  { month: 'Jan', visitors: 12400, capacity: 15000 },
  { month: 'Feb', visitors: 11800, capacity: 15000 },
  { month: 'Mar', visitors: 16200, capacity: 15000 },
  { month: 'Apr', visitors: 14100, capacity: 15000 },
  { month: 'May', visitors: 13600, capacity: 15000 },
  { month: 'Jun', visitors: 17800, capacity: 15000 },
  { month: 'Jul', visitors: 15300, capacity: 15000 },
]

const carbonByDestination = [
  { name: 'Kinabalu', carbon: 342 },
  { name: 'Penang', carbon: 189 },
  { name: 'Tioman', carbon: 98 },
  { name: 'T. Negara', carbon: 421 },
  { name: 'Endau', carbon: 67 },
  { name: 'Redang', carbon: 143 },
]

const alerts = [
  {
    destination: 'Taman Negara',
    type: 'Overcrowding',
    severity: 'critical',
    time: '10 min ago',
  },
  {
    destination: 'Penang Hill',
    type: 'High AQI (67)',
    severity: 'warning',
    time: '25 min ago',
  },
  {
    destination: 'Kinabalu Park',
    type: 'Flash flood risk',
    severity: 'warning',
    time: '1 hr ago',
  },
  {
    destination: 'Tioman Island',
    type: 'Coral bleaching detected',
    severity: 'critical',
    time: '2 hr ago',
  },
]

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '0.75rem',
}

const severityConfig = {
  critical: { color: '#ef4444', background: '#fef2f2' },
  warning: { color: '#f59e0b', background: '#fffbeb' },
}

const kpis = [
  {
    label: 'Total Tourists',
    value: '15,342',
    delta: '+8.2% this month',
    positive: true,
    color: '#3b82f6',
    icon: Users,
    page: 'reports',
  },
  {
    label: 'Active Locations',
    value: '24',
    delta: '2 near capacity',
    positive: false,
    color: '#22c55e',
    icon: MapPin,
    page: 'locations',
  },
  {
    label: 'Active Alerts',
    value: '7',
    delta: '2 critical',
    positive: false,
    color: '#ef4444',
    icon: AlertTriangle,
    page: 'thresholds',
  },
  {
    label: 'Avg Carbon/Trip',
    value: '8.4 kg',
    delta: '-5.1% vs last month',
    positive: true,
    color: '#8b5cf6',
    icon: TrendingDown,
    page: 'reports',
  },
]

const statusSummary = [
  {
    label: 'Locations Optimal',
    value: 18,
    total: 24,
    color: '#22c55e',
    icon: CheckCircle,
  },
  {
    label: 'Near Capacity',
    value: 4,
    total: 24,
    color: '#f59e0b',
    icon: Clock,
  },
  {
    label: 'Alerts Resolved Today',
    value: 12,
    total: 19,
    color: '#3b82f6',
    icon: CheckCircle,
  },
  {
    label: 'Users Active Now',
    value: 342,
    total: 15342,
    color: '#8b5cf6',
    icon: Users,
  },
]

export default function AdminDashboard({ onNavigate }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Admin Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Taman Negara — July 2026
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5">
          <span className="size-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-700">
            All Systems Operational
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, delta, positive, color, icon: Icon, page }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(page)}
            className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <span
                className="grid size-8 place-items-center rounded-lg"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={16} style={{ color }} />
              </span>
            </div>

            <strong className="text-2xl leading-none" style={{ color }}>
              {value}
            </strong>

            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: positive ? '#22c55e' : '#f59e0b' }}
            >
              {positive ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {delta}
            </span>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              Visitor Trend vs Capacity
            </h2>
            <span className="text-xs text-slate-400">Monthly 2026</span>
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <AreaChart
              data={visitorTrend}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="visitor-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="capacity"
                name="Capacity"
                stroke="#ef444480"
                strokeWidth={1.5}
                fill="none"
                strokeDasharray="5 3"
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="visitors"
                name="Visitors"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#visitor-gradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Latest Alerts</h2>
            <button
              type="button"
              onClick={() => onNavigate('thresholds')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity]

              return (
                <div
                  key={`${alert.destination}-${alert.type}`}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{ backgroundColor: config.background }}
                >
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: config.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {alert.destination}
                    </p>
                    <p className="text-xs text-slate-500">{alert.type}</p>
                    <p className="mt-0.5 text-xs" style={{ color: config.color }}>
                      {alert.severity} · {alert.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </section>

      <ChartCard>
        <h2 className="mb-4 font-bold text-slate-900">
          Carbon Emission by Destination (kg CO₂, July 2026)
        </h2>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={carbonByDestination}
            margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${value} kg CO₂`, 'Carbon']}
            />
            <Bar
              isAnimationActive={false}
              dataKey="carbon"
              name="Carbon (kg)"
              fill="#3b82f6"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statusSummary.map(({ label, value, total, color, icon: Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon size={14} style={{ color }} />
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-extrabold leading-none" style={{ color }}>
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              of {total.toLocaleString()}
            </p>
          </article>
        ))}
      </section>
    </div>
  )
}

function ChartCard({ className = '', children }) {
  return (
    <article
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </article>
  )
}