import { useMemo, useState } from 'react'
import { CalendarClock, Edit3, Plus, RefreshCw, Trash2, Truck } from 'lucide-react'
import { cancelWasteSchedule } from '../../../services/wasteService'
import WasteScheduleForm from './WasteScheduleForm'
import TablePagination from '../../../components/TablePagination'
import useTablePagination from '../../../hooks/useTablePagination'

export default function WasteScheduleManager({ location, schedules, loading, onRefresh, onRecordCollection }) {
  const [editor, setEditor] = useState(null)
  const [filter, setFilter] = useState('all')
  const [workingId, setWorkingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const visibleSchedules = useMemo(() => schedules.filter((schedule) => {
    const displayStatus = statusFor(schedule)
    return filter === 'all' || displayStatus === filter
  }), [filter, schedules])
  const nextSchedule = useMemo(() => [...schedules]
    .filter((schedule) => statusFor(schedule) === 'scheduled' && new Date(schedule.scheduled_for) > new Date())
    .sort((left, right) => new Date(left.scheduled_for) - new Date(right.scheduled_for))[0], [schedules])
  const schedulePages = useTablePagination(visibleSchedules)

  async function scheduleSaved(_saved, editing) {
    await onRefresh()
    setEditor(null)
    setError('')
    setNotice(editing ? 'Collection schedule updated.' : 'Collection schedule created.')
  }

  async function cancelSchedule(schedule) {
    const confirmed = window.confirm(`Cancel the collection scheduled for ${formatDate(schedule.scheduled_for)}? The schedule will remain in the audit history.`)
    if (!confirmed) return

    setWorkingId(schedule.id)
    setNotice('')
    setError('')
    try {
      await cancelWasteSchedule(schedule.id)
      await onRefresh()
      setNotice('Collection schedule cancelled. Its audit record was retained.')
    } catch (cancelError) {
      setError(cancelError.message || 'Unable to cancel the collection schedule.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <>
      <section className="mb-4 flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-500"><CalendarClock size={19} /></span>
        <div>
          <p className="text-xs font-medium text-slate-500">Next collection</p>
          <p className="mt-1 font-bold text-slate-800">{loading ? 'Loading...' : nextSchedule ? formatDate(nextSchedule.scheduled_for) : 'Not scheduled'}</p>
          <p className="mt-0.5 text-xs text-slate-400">{nextSchedule?.assigned_team || 'No upcoming collection window'}</p>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><h2 className="flex items-center gap-2 font-bold text-slate-800"><CalendarClock size={18} className="text-blue-500" />Collection schedules</h2><p className="mt-1 text-xs text-slate-400">Plan non-overlapping collection windows for {location?.name || 'the selected location'}. Cancelled schedules are retained, not deleted.</p></div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter schedules" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              <option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="missed">Missed</option><option value="cancelled">Cancelled</option>
            </select>
            <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
            <button type="button" onClick={() => { setEditor({ schedule: null }); setNotice(''); setError('') }} disabled={!location} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} />New schedule</button>
          </div>
        </header>

        {(notice || error) && <div className={`m-4 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}>{error || notice}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Collection window</th><th className="px-5 py-3">Waste type</th><th className="px-5 py-3">Assigned team</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Notes</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {schedulePages.pageItems.map((schedule) => {
                const displayStatus = statusFor(schedule)
                const canEdit = schedule.status === 'scheduled' && new Date(schedule.scheduled_for) > new Date()
                const canAct = schedule.status === 'scheduled'
                return (
                  <tr key={schedule.id}>
                    <td className="whitespace-nowrap px-5 py-4"><p className="font-semibold text-slate-700">{formatDate(schedule.scheduled_for)}</p><p className="mt-0.5 text-xs text-slate-400">to {formatDate(schedule.scheduled_until)}</p></td>
                    <td className="px-5 py-4 capitalize text-slate-600">{schedule.waste_type}</td>
                    <td className="px-5 py-4 text-slate-600">{schedule.assigned_team}</td>
                    <td className="px-5 py-4"><StatusBadge status={displayStatus} /></td>
                    <td className="max-w-xs px-5 py-4 text-slate-500">{schedule.notes || '-'}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-1">
                      {canAct && <button type="button" onClick={() => onRecordCollection(schedule)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"><Truck size={14} />Record</button>}
                      {canEdit && <button type="button" onClick={() => { setEditor({ schedule }); setNotice(''); setError('') }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"><Edit3 size={14} />Edit</button>}
                      {canAct && <button type="button" onClick={() => cancelSchedule(schedule)} disabled={workingId === schedule.id} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />Cancel</button>}
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && visibleSchedules.length > 0 && <TablePagination {...schedulePages} onPageChange={schedulePages.setPage} label="schedules" />}
        {loading && <p className="p-10 text-center text-sm text-slate-400">Loading collection schedules...</p>}
        {!loading && !visibleSchedules.length && <p className="p-10 text-center text-sm text-slate-400">{schedules.length ? 'No schedules match this status filter.' : 'No collection schedules have been saved for this location.'}</p>}
      </section>

      {editor && <WasteScheduleForm key={editor.schedule?.id || 'new'} location={location} schedule={editor.schedule} schedules={schedules} onClose={() => setEditor(null)} onSaved={scheduleSaved} />}
    </>
  )
}

function statusFor(schedule) {
  return schedule.status === 'scheduled' && new Date(schedule.scheduled_until) < new Date() ? 'overdue' : schedule.status
}

function StatusBadge({ status }) {
  const styles = { scheduled: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700', cancelled: 'bg-slate-100 text-slate-600', missed: 'bg-red-50 text-red-600', overdue: 'bg-amber-50 text-amber-700' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || styles.cancelled}`}>{status}</span>
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
