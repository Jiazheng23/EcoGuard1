import { useMemo } from 'react'
import { BarChart3, ClipboardCheck, Recycle, Scale, Trash2, TriangleAlert } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  filterWasteCollections,
  getWasteSourceSeries,
  getWasteTrendSeries,
  getWasteTypeSeries,
  summarizeWasteCollections,
} from '../../../utils/wasteAnalytics'
import WasteCollectionFilters from './WasteCollectionFilters'
import WasteReportExport from './WasteReportExport'

const chartTick = { fontSize: 10, fill: '#94a3b8' }
const typeColors = ['#f97316', '#22c55e', '#3b82f6', '#ef4444']

export default function WasteAnalytics({ location, collections, filters, onFiltersChange, exportAudits, onExported, loading }) {
  const filteredCollections = useMemo(() => filterWasteCollections(collections, filters), [collections, filters])
  const summary = useMemo(() => summarizeWasteCollections(filteredCollections), [filteredCollections])
  const trend = useMemo(() => getWasteTrendSeries(filteredCollections), [filteredCollections])
  const wasteTypes = useMemo(() => getWasteTypeSeries(filteredCollections), [filteredCollections])
  const sources = useMemo(() => getWasteSourceSeries(filteredCollections), [filteredCollections])
  const cards = [
    ['Total collected', `${summary.totalKg.toFixed(2)} kg`, Trash2, '#f97316'],
    ['Total recycled', `${summary.recycledKg.toFixed(2)} kg`, Recycle, '#22c55e'],
    ['Landfill waste', `${summary.landfillKg.toFixed(2)} kg`, Scale, '#64748b'],
    ['Recycling rate', `${summary.recyclingRate.toFixed(1)}%`, BarChart3, '#3b82f6'],
    ['Successful records', summary.successfulCount, ClipboardCheck, '#8b5cf6'],
    ['Missed records', summary.missedCount, TriangleAlert, '#ef4444'],
  ]

  return (
    <div className="flex flex-col gap-6">
      <header><h2 className="font-bold text-slate-800">Persisted waste analytics</h2><p className="mt-1 text-xs text-slate-400">Calculated only from saved collection records for {location?.name || 'the selected location'}; temporary simulator drift is excluded.</p></header>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3"><h3 className="text-sm font-bold text-slate-700">Analytics and report filters</h3><p className="mt-0.5 text-xs text-slate-400">These filters stay synchronized with Collection History.</p></div>
        <WasteCollectionFilters filters={filters} onChange={onFiltersChange} />
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value, Icon, color]) => <article key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><Icon size={18} style={{ color }} /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-800">{loading ? '-' : value}</p></article>)}
      </section>

      <section className={`rounded-2xl border p-5 ${summary.hasTrend ? 'border-blue-100 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <h3 className="font-semibold">{summary.hasTrend ? 'Trend data is available' : 'Insufficient data for trend analysis'}</h3>
        <p className="mt-1 text-sm leading-6">{summary.hasTrend ? `${summary.successfulCount} completed or partial records provide enough persisted data for a trend. Peak collection period: ${summary.peakPeriod} at ${summary.peakKg.toFixed(2)} kg.` : 'At least two completed or partial collection records are required. Available totals are shown without claiming a trend.'}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Collected, recycled, and landfill trend" detail="kg by collection date">
          {summary.hasTrend ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={trend} margin={{ left: -12, right: 8 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={chartTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartTick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} kg`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recycledKg" name="Recycled" stackId="result" fill="#22c55e" isAnimationActive={false} />
                <Bar dataKey="landfillKg" name="Landfill" stackId="result" fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="Save at least two completed or partial collection records to display a trend chart." />}
        </ChartCard>

        <ChartCard title="Waste by type" detail="filtered total kg">
          {wasteTypes.length ? (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={wasteTypes} layout="vertical" margin={{ left: 8, right: 18 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={chartTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={72} tick={chartTick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kg`, 'Collected']} />
                <Bar dataKey="totalKg" radius={[0, 5, 5, 0]} isAnimationActive={false}>{wasteTypes.map((item, index) => <Cell key={item.type} fill={typeColors[index % typeColors.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No waste-type totals match the current filters." />}
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ChartCard title="Collection data sources" detail="record count">
          {sources.length ? (
            <div className="grid min-h-[220px] items-center md:grid-cols-[1fr_150px]">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart><Pie data={sources} dataKey="count" nameKey="label" innerRadius={48} outerRadius={76} paddingAngle={3} isAnimationActive={false}>{sources.map((item) => <Cell key={item.source} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [`${value} records`, 'Source']} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">{sources.map((item) => <p key={item.source} className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span><b className="text-slate-700">{item.count}</b></p>)}</div>
            </div>
          ) : <EmptyChart message="No source information matches the current filters." />}
        </ChartCard>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800">Operational statistics</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Statistic label="Average per successful collection" value={`${summary.averageKg.toFixed(2)} kg`} />
            <Statistic label="Peak collection period" value={summary.peakPeriod || 'Not available'} detail={summary.peakPeriod ? `${summary.peakKg.toFixed(2)} kg collected` : 'No persisted quantity'} />
            <Statistic label="Completed / partial" value={`${summary.completedCount} / ${summary.partialCount}`} />
            <Statistic label="Manual / simulated records" value={`${summary.manualCount} / ${summary.simulatedCount}`} detail="Simulated records are explicitly labelled" />
          </div>
        </article>
      </section>

      <WasteReportExport location={location} collections={filteredCollections} filters={filters} summary={summary} trend={trend} exportAudits={exportAudits} onExported={onExported} />
    </div>
  )
}

function ChartCard({ title, detail, children }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><h3 className="font-bold text-slate-800">{title}</h3><span className="text-xs text-slate-400">{detail}</span></div>{children}</article>
}

function EmptyChart({ message }) {
  return <div className="grid min-h-[250px] place-items-center rounded-xl bg-slate-50 p-5 text-center text-sm leading-6 text-slate-400">{message}</div>
}

function Statistic({ label, value, detail }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-800">{value}</p>{detail && <p className="mt-1 text-[11px] text-slate-400">{detail}</p>}</div>
}
