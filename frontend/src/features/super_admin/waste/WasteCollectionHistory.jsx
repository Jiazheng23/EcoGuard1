import { useMemo } from 'react'
import { ClipboardList, Plus, RefreshCw } from 'lucide-react'
import { filterWasteCollections } from '../../../utils/wasteAnalytics'
import WasteCollectionFilters from './WasteCollectionFilters'

export default function WasteCollectionHistory({ location, collections, filters, onFiltersChange, loading, onRefresh, onCreateCollection }) {
  const filteredCollections = useMemo(() => filterWasteCollections(collections, filters), [collections, filters])

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div><h2 className="flex items-center gap-2 font-bold text-slate-800"><ClipboardList size={18} className="text-green-500" />Collection history</h2><p className="mt-1 text-xs text-slate-400">Immutable persisted collection records for {location?.name || 'the selected location'}.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={onCreateCollection} disabled={!location} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} />Record unscheduled collection</button>
        </div>
      </header>

      <div className="border-b border-slate-100 bg-slate-50/60 p-4"><WasteCollectionFilters filters={filters} onChange={onFiltersChange} /></div>

      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs text-slate-400"><span>{filteredCollections.length} of {collections.length} records shown</span><span>History records cannot be edited or deleted</span></div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Collected at</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Recycled</th><th className="px-5 py-3">Landfill</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Notes</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCollections.map((record) => (
              <tr key={record.id}>
                <td className="whitespace-nowrap px-5 py-4"><p className="font-semibold text-slate-700">{formatDate(record.collected_at)}</p><p className="mt-0.5 text-[11px] text-slate-400">{record.schedule_id ? `Schedule #${record.schedule_id}` : 'Unscheduled'}</p></td>
                <td className="px-5 py-4 capitalize text-slate-600">{record.waste_type}</td>
                <td className="px-5 py-4 text-slate-700">{formatKg(record.total_kg)}</td>
                <td className="px-5 py-4 text-green-600">{formatKg(record.recycled_kg)}</td>
                <td className="px-5 py-4 text-slate-600">{formatKg(record.landfill_kg)}</td>
                <td className="px-5 py-4"><SourceBadge source={record.source} /></td>
                <td className="px-5 py-4"><StatusBadge status={record.status} /></td>
                <td className="max-w-xs px-5 py-4 text-slate-500">{record.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="p-10 text-center text-sm text-slate-400">Loading collection history...</p>}
      {!loading && !filteredCollections.length && <p className="p-10 text-center text-sm text-slate-400">{collections.length ? 'No collection records match the selected filters.' : 'No collection history is available for this location.'}</p>}
    </section>
  )
}

function SourceBadge({ source }) {
  const simulated = source === 'simulated_sensor'
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${simulated ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>{simulated ? 'Automated sensor' : 'Manual'}</span>
}

function StatusBadge({ status }) {
  const styles = { completed: 'bg-green-50 text-green-700', partial: 'bg-amber-50 text-amber-700', missed: 'bg-red-50 text-red-600' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatKg(value) {
  return `${Number(value || 0).toFixed(2)} kg`
}
