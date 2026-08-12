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
} from "recharts";
import {
  ArrowRight,
  Calculator,
  Car,
  Clock3,
  Map,
  Train,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const monthlyEmission = [
  { month: "Jan", emission: 124 },
  { month: "Feb", emission: 98 },
  { month: "Mar", emission: 142 },
  { month: "Apr", emission: 87 },
  { month: "May", emission: 103 },
  { month: "Jun", emission: 76 },
  { month: "Jul", emission: 89 },
];
const weeklyTrend = [
  { day: "Mon", emission: 3.2 },
  { day: "Tue", emission: 5.1 },
  { day: "Wed", emission: 2.8 },
  { day: "Thu", emission: 4.4 },
  { day: "Fri", emission: 6.2 },
  { day: "Sat", emission: 8.1 },
  { day: "Sun", emission: 4.2 },
];
const transportMix = [
  { name: "Private Car", value: 42, color: "#ef4444" },
  { name: "Public Bus", value: 28, color: "#f59e0b" },
  { name: "Train/MRT", value: 22, color: "#3b82f6" },
  { name: "Walking/Bike", value: 8, color: "#22c55e" },
];
const trips = [
  {
    from: "Kuala Lumpur",
    to: "Taman Negara",
    mode: "car",
    emission: "9.2 kg CO₂",
    date: "28 Jul 2026",
    score: -3,
  },
  {
    from: "KL Sentral",
    to: "Penang Hill",
    mode: "train",
    emission: "1.8 kg CO₂",
    date: "25 Jul 2026",
    score: 5,
  },
  {
    from: "Kuala Lumpur",
    to: "Tioman Island",
    mode: "bus",
    emission: "4.1 kg CO₂",
    date: "20 Jul 2026",
    score: 2,
  },
];
const badges = [
  { name: "Green Traveler", icon: "🌿", earned: true },
  { name: "Carbon Saver", icon: "💚", earned: true },
  { name: "Eco Hero", icon: "🦸", earned: false },
  { name: "Daily Streak", icon: "🔥", earned: false },
  { name: "Zero Waste", icon: "♻️", earned: false },
  { name: "Trail Blazer", icon: "🏞️", earned: true },
];
const chartStyle = { fontSize: 11, fill: "#94a3b8" };
const card = "rounded-2xl border border-slate-100 bg-white p-5 shadow-sm";

function EcoGauge() {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-[120px] place-items-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.28}
        />
      </svg>
      <div className="absolute text-center">
        <b className="block text-3xl leading-none text-green-500">72</b>
        <span className="text-[9px] font-bold tracking-widest text-slate-500">
          ECO SCORE
        </span>
      </div>
    </div>
  );
}

export default function TouristDashboard({ onNavigate, user }) {
  const fullName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Tourist";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 p-6 text-white shadow-lg shadow-green-600/20 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-white/75">Good morning, 👋</p>
          <h1 className="mt-1 text-2xl font-bold">{fullName}</h1>
          <p className="mt-1 text-xs text-white/70">{user?.email}</p>
          <p className="mt-1 text-sm text-white/75">
            You've saved 47.2 kg CO₂ this month. Keep it up!
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate("carbon")}
            className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold"
          >
            <Calculator size={16} /> Calculate Trip
          </button>
          <button
            onClick={() => onNavigate("monitoring")}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-green-700"
          >
            <Map size={16} /> Eco Map
          </button>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Eco Score",
            value: "72",
            unit: "/ 100",
            delta: "+4 this week",
            color: "text-green-500",
          },
          {
            label: "Today's Emission",
            value: "4.2",
            unit: "kg CO₂",
            delta: "-1.8 vs yesterday",
            color: "text-blue-500",
          },
          {
            label: "Monthly Emission",
            value: "89.4",
            unit: "kg CO₂",
            delta: "-12% vs last month",
            color: "text-violet-500",
          },
          {
            label: "Badges Earned",
            value: "3",
            unit: "/ 6",
            delta: "3 in progress",
            color: "text-amber-500",
            progress: true,
          },
        ].map((item) => (
          <article className={card} key={item.label}>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold ${item.color}`}>
              {item.value}
              <span className="ml-1 text-xs font-normal text-slate-400">
                {item.unit}
              </span>
            </p>
            <p
              className={`mt-2 flex items-center gap-1 text-xs ${item.progress ? "text-slate-500" : "text-green-600"}`}
            >
              {item.progress ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              )}
              {item.delta}
            </p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <article
          className={`${card} flex flex-col items-center justify-center gap-3`}
        >
          <EcoGauge />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              Good — Above Average
            </p>
            <p className="text-xs text-slate-400">Top 34% of EcoGuard users</p>
          </div>
          <p className="flex items-center gap-1 text-xs font-medium text-green-600">
            <TrendingDown size={14} /> +4 points this week
          </p>
        </article>
        <ChartCard title="Monthly Emission History">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyEmission} margin={{ left: -22 }}>
              <CartesianGrid
                stroke="#f1f5f9"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={chartStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={chartStyle} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="emission" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Transport Usage">
          <div className="h-[138px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={transportMix}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                >
                  {transportMix.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1">
            {transportMix.map((item) => (
              <p
                className="flex justify-between text-xs text-slate-500"
                key={item.name}
              >
                <span className="flex items-center gap-1.5">
                  <i
                    className="size-2 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <b className="text-slate-700">{item.value}%</b>
              </p>
            ))}
          </div>
        </ChartCard>
      </section>
      <ChartCard title="Weekly Carbon Trend" aside="kg CO₂ / day">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={weeklyTrend} margin={{ left: -20 }}>
            <defs>
              <linearGradient id="green-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity=".25" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tick={chartStyle}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={chartStyle} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="emission"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#green-area)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <article className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">
            Achievement Badges{" "}
            <span className="font-normal text-slate-400">(3 of 6 earned)</span>
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {badges.map((badge) => (
            <div
              className={`rounded-xl border p-3 text-center ${badge.earned ? "border-green-200 bg-green-50" : "border-slate-100 bg-slate-50 opacity-60"}`}
              key={badge.name}
            >
              <span className="text-xl">{badge.icon}</span>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {badge.name}
              </p>
              {badge.earned && (
                <span className="mt-1 inline-block rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>
      </article>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <div className="mb-4 flex justify-between">
            <h2 className="font-bold text-slate-800">Recent Trips</h2>
            <button
              onClick={() => onNavigate("reports")}
              className="flex items-center gap-1 text-xs font-semibold text-green-600"
            >
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div className="space-y-3">
            {trips.map((trip) => (
              <div
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                key={trip.to}
              >
                <span
                  className={`grid size-8 place-items-center rounded-lg ${trip.mode === "car" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}
                >
                  {trip.mode === "car" ? (
                    <Car size={15} />
                  ) : (
                    <Train size={15} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {trip.from} → {trip.to}
                  </p>
                  <p className="text-xs text-slate-400">{trip.date}</p>
                </div>
                <div className="text-right text-xs">
                  <b className="text-slate-700">{trip.emission}</b>
                  <p
                    className={
                      trip.score > 0 ? "text-green-600" : "text-red-500"
                    }
                  >
                    {trip.score > 0 ? "+" : ""}
                    {trip.score} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className={card}>
          <h2 className="mb-4 font-bold text-slate-800">Eco Recommendations</h2>
          <div className="space-y-3">
            {[
              [
                Train,
                "Take the ETS train for your next trip to Penang — saves 6.4 kg CO₂ vs driving.",
                "text-blue-500",
              ],
              [
                Car,
                "Your Friday emissions spike 2.3× above average. Consider carpooling.",
                "text-amber-500",
              ],
              [
                Clock3,
                "Visit Kinabalu Park on weekdays — crowd level is 60% lower than weekends.",
                "text-green-500",
              ],
            ].map(([Icon, text, color]) => (
              <div
                className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                key={text}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg bg-white ${color}`}
                >
                  <Icon size={16} />
                </span>
                <p className="text-sm leading-5 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("carbon")}
            className="mt-4 w-full rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white"
          >
            Calculate New Trip
          </button>
        </article>
      </section>
    </div>
  );
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
  );
}
