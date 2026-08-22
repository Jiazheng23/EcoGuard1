import { CalendarClock, ClipboardCheck, Database } from 'lucide-react'
import WasteSimulator from './WasteSimulator'
import WasteThresholdSettings from './WasteThresholdSettings'

export default function WasteOverview({ location, baseline, threshold, schedules, collections, loading, onDataChange, onThresholdSaved }) {
  const nextSchedule = [...schedules]
    .filter((item) => item.status === 'scheduled' && new Date(item.scheduled_for) > new Date())
    .sort((left, right) => new Date(left.scheduled_for) - new Date(right.scheduled_for))[0]
  const latestCollection = [...collections]
    .sort((left, right) => new Date(right.collected_at) - new Date(left.collected_at))[0]

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <OverviewCard icon={CalendarClock} label="Next collection" value={loading ? 'Loading…' : nextSchedule ? formatDate(nextSchedule.scheduled_for) : 'Not scheduled'} detail={nextSchedule?.assigned_team || 'No upcoming collection window'} color="#3b82f6" />
        <OverviewCard icon={ClipboardCheck} label="Collection records" value={loading ? 'Loading…' : collections.length} detail={latestCollection ? `Latest ${formatDate(latestCollection.collected_at)}` : 'No persisted collection history'} color="#22c55e" />
        <OverviewCard icon={Database} label="Latest saved reading" value={loading ? 'Loading…' : baseline ? `${Number(baseline.waste_kg || 0).toFixed(2)} kg` : 'No snapshot'} detail={baseline ? `Simulated · ${formatDate(baseline.recorded_at)}` : 'Save a simulated snapshot below'} color="#f97316" />
      </section>

      <WasteSimulator key={`${location.id}-${baseline?.id || 'new'}`} location={location} baseline={baseline} threshold={threshold} onDataChange={onDataChange} />
      <WasteThresholdSettings key={`${location.id}-${threshold?.updated_at || 'defaults'}`} location={location} threshold={threshold} onSaved={onThresholdSaved} />
    </div>
  )
}

function OverviewCard({ icon: Icon, label, value, detail, color }) {
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="grid size-9 place-items-center rounded-xl" style={{ color, background: `${color}12` }}><Icon size={18} /></span><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-800">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></article>
}

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
