import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, History } from 'lucide-react'
import { filterWasteAlerts, wasteAlertResponse, wasteScheduleStatus } from '../../../utils/wasteWorkflow'
import { linkWasteScheduleToAlert } from '../../../services/wasteService'
import { useToast } from '../../../components/toastContext'
import useWasteClock from '../../../hooks/useWasteClock'
import TablePagination from '../../../components/TablePagination'
import useTablePagination from '../../../hooks/useTablePagination'

const levels = { caution: ['Moderate', 'bg-amber-50 text-amber-700'], warning: ['High', 'bg-orange-50 text-orange-700'], critical: ['Critical', 'bg-red-50 text-red-700'] }
const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500'
const actionClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50'

export default function WasteAlertHistory({ location, alerts, schedules, collections, loading, error, focusId, onSchedule, onCollect, onRefresh }) {
  const [level, setLevel] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(focusId || null)
  const [linkSelection, setLinkSelection] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linking, setLinking] = useState(false)
  const toast = useToast()
  const now = useWasteClock()
  const filtered = useMemo(() => filterWasteAlerts(alerts, [location.id], { level, status, query })
    .filter((alert) => !focusId || String(alert.id) === String(focusId)), [alerts, location.id, level, status, query, focusId])
  const pages = useTablePagination(filtered)
  const unresolved = alerts.filter((alert) => String(alert.location_id) === String(location.id) && !alert.resolved_at).length

  async function link(alert) {
    if (!linkSelection) {
      setLinkError('Choose a collection schedule to link.')
      toast.reminder('Choose a collection schedule to link.')
      return
    }
    setLinkError('')
    setLinking(true)
    try {
      await linkWasteScheduleToAlert(linkSelection, alert.id)
      toast.success('Collection schedule linked to the waste alert.')
      setLinkSelection('')
      await onRefresh()
    } catch (failure) { toast.error(failure.message || 'Unable to link this schedule.') }
    finally { setLinking(false) }
  }

  return <section className="space-y-4">
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold text-slate-800"><History size={20} className="text-orange-500" />Waste Alert History</h2><p className="mt-1 text-sm text-slate-500">{location.name} · {filtered.length} records · {unresolved} unresolved</p></div></header>
    <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">Collection results track the response to an alert. Sensor alerts close when the monitored condition changes or clears; a recorded collection alone does not confirm that waste levels are safe.</p>
    <div className="flex flex-wrap gap-3">
      <input aria-label="Search waste alerts" className={control} placeholder="Search alerts..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Alert level" className={control} value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{Object.entries(levels).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Alert status" className={control} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="unresolved">Unresolved</option><option value="resolved">Resolved</option></select>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm" aria-busy={loading}>
      <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Alert / Location', 'Triggered at', 'Waste / Threshold', 'Level', 'Sensor status', 'Response', 'Actions'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{!error && pages.pageItems.map((alert) => {
        const response = wasteAlertResponse(alert.id, schedules, collections)
        const [label, color] = levels[alert.severity] || ['Unknown', 'bg-slate-50 text-slate-500']
        const resolved = Boolean(alert.resolved_at)
        const Icon = resolved ? CheckCircle2 : AlertTriangle
        const open = String(expanded) === String(alert.id)
        const availableSchedules = schedules.filter((schedule) => schedule.status === 'scheduled' && !schedule.alert_id && String(schedule.location_id) === String(alert.location_id))
        return <Fragment key={alert.id}><tr>
          <td className="px-4 py-4"><b>#{alert.id}</b><p className="mt-1 text-xs text-slate-500">{location.name}</p></td>
          <td className="px-4 py-4 text-slate-600">{formatDate(alert.created_at)}</td>
          <td className="px-4 py-4"><b>{Number(alert.current_value).toFixed(2)} kg</b><p className="text-xs text-slate-400">{label} from {Number(alert.threshold_value).toFixed(2)} kg</p></td>
          <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span></td>
          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${resolved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><Icon size={13} />{resolved ? 'Resolved' : 'Unresolved'}</span>{resolved && <p className="mt-1 text-xs text-slate-400">{formatDate(alert.resolved_at)}</p>}</td>
          <td className="px-4 py-4 text-xs text-slate-600">{response.activeSchedule ? `Schedule #${response.activeSchedule.id} · ${wasteScheduleStatus(response.activeSchedule, now)}` : response.collections.length ? `${response.collections.length} collection attempt(s)` : 'No active collection planned'}<p className="mt-1">{response.collections.filter((row) => row.status !== 'missed').reduce((sum, row) => sum + Number(row.total_kg), 0).toFixed(2)} kg collected</p></td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" className={actionClass} onClick={() => { setExpanded(open ? null : alert.id); setLinkSelection('') }}>{open ? 'Hide' : 'Details'}</button>{response.activeSchedule ? <button type="button" className={actionClass} onClick={() => onCollect(response.activeSchedule, alert)}>Record collection</button> : !resolved && <><button type="button" className={actionClass} onClick={() => onSchedule(alert)}>Schedule collection</button><button type="button" className={actionClass} onClick={() => onCollect(null, alert)}>Record now</button></>}</div></td>
        </tr>{open && <tr><td colSpan={7} className="bg-slate-50/60 p-5"><p className="mb-3 text-sm text-slate-600">{alert.detail}</p>
          <div className="grid gap-4 lg:grid-cols-2"><div><h3 className="font-semibold text-slate-800">Linked schedules</h3>{response.schedules.length ? response.schedules.map((schedule) => <div key={schedule.id} className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><b>Schedule #{schedule.id} · {wasteScheduleStatus(schedule, now)}</b><p className="mt-1">{formatDate(schedule.scheduled_for)} – {formatDate(schedule.scheduled_until)}</p><p className="mt-1">Team: {schedule.assigned_team}</p>{schedule.notes && <p className="mt-1 whitespace-pre-wrap">{schedule.notes}</p>}</div>) : <p className="mt-2 text-xs text-slate-400">No linked schedules.</p>}</div>
          <div><h3 className="font-semibold text-slate-800">Collection results / action taken</h3>{response.collections.length ? response.collections.map((record) => <div key={record.id} className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><b>Collection #{record.id} · {record.status} · {Number(record.total_kg).toFixed(2)} kg</b><p className="mt-1">{formatDate(record.collected_at)} · {record.schedule_id ? `Schedule #${record.schedule_id}` : 'Unscheduled response'}</p><p className="mt-1 whitespace-pre-wrap">{record.notes || 'No additional notes recorded.'}</p></div>) : <p className="mt-2 text-xs text-slate-400">No collection attempt recorded.</p>}</div></div>
          {!resolved && !response.activeSchedule && availableSchedules.length > 0 && (
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <div>
                <select aria-label="Existing schedule to link" aria-invalid={Boolean(linkError)} aria-describedby={linkError ? `link-error-${alert.id}` : undefined} disabled={linking} className={`${control} ${linkError ? 'border-red-500 focus:border-red-500' : ''}`} value={linkSelection} onChange={(event) => { setLinkSelection(event.target.value); setLinkError('') }}>
                  <option value="">Choose an existing schedule</option>
                  {availableSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>#{schedule.id} · {formatDate(schedule.scheduled_for)} · {schedule.assigned_team}</option>)}
                </select>
                {linkError && <p id={`link-error-${alert.id}`} className="mt-1 text-xs text-red-600">{linkError}</p>}
              </div>
              <button type="button" className={actionClass} disabled={linking} onClick={() => link(alert)}>{linking ? 'Linking...' : 'Link schedule'}</button>
            </div>
          )}
        </td></tr>}</Fragment>
      })}{(!filtered.length || error) && <tr><td colSpan={7} className="p-10 text-center text-slate-400">{error ? 'Alert history is unavailable. Refresh to retry.' : loading ? 'Loading alerts...' : 'No waste alerts match your filters.'}</td></tr>}</tbody>
    </table></div>{!error && filtered.length > 0 && <TablePagination {...pages} onPageChange={pages.setPage} label="alerts" />}</div>
  </section>
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
}
